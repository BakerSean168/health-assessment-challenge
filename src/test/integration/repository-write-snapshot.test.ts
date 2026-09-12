import { afterAll, afterEach, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../lib/db";
import { PrismaAssessmentRepository } from "../../modules/assessment/infrastructure/prisma-assessment-repository";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";
const prisma = createPrismaClient(testDatabaseUrl);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(async () => {
  await prisma.anonymousSession.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("assessment repository write snapshot", () => {
  it("returns the exact row produced by its CAS write even if a later revision commits before the repository call resolves", async () => {
    const session = await prisma.anonymousSession.create({
      data: {
        assessment: { create: {} },
        subscription: { create: {} },
      },
    });
    const raceClient = createPrismaClient(testDatabaseUrl);
    const repository = new PrismaAssessmentRepository(raceClient);
    const mutationCommitted = deferred();
    const releaseFirstWriter = deferred();

    const assessmentDelegate = raceClient.assessment;
    const originalUpdateMany = assessmentDelegate.updateMany.bind(assessmentDelegate);
    const originalUpdateManyAndReturn =
      assessmentDelegate.updateManyAndReturn.bind(assessmentDelegate);

    Object.defineProperty(assessmentDelegate, "updateMany", {
      configurable: true,
      value: async (...args: Parameters<typeof originalUpdateMany>) => {
        const result = await originalUpdateMany(...args);
        mutationCommitted.resolve();
        await releaseFirstWriter.promise;
        return result;
      },
    });
    Object.defineProperty(assessmentDelegate, "updateManyAndReturn", {
      configurable: true,
      value: async (...args: Parameters<typeof originalUpdateManyAndReturn>) => {
        const result = await originalUpdateManyAndReturn(...args);
        mutationCommitted.resolve();
        await releaseFirstWriter.promise;
        return result;
      },
    });

    try {
      const firstWrite = repository.saveStep({
        sessionId: session.id,
        step: "GENDER",
        value: "MALE",
        expectedRevision: 0,
      });

      await mutationCommitted.promise;
      await prisma.assessment.updateMany({
        where: { sessionId: session.id, revision: 1 },
        data: { goal: "LOSE_WEIGHT", revision: { increment: 1 } },
      });
      releaseFirstWriter.resolve();

      const result = await firstWrite;
      expect(result.kind).toBe("saved");
      if (result.kind !== "saved") return;
      expect(result.assessment.revision).toBe(1);
      expect(result.assessment.answers.gender).toBe("MALE");
      expect(result.assessment.answers.goal).toBeNull();

      const canonical = await prisma.assessment.findUniqueOrThrow({
        where: { sessionId: session.id },
      });
      expect(canonical.revision).toBe(2);
      expect(canonical.goal).toBe("LOSE_WEIGHT");
    } finally {
      releaseFirstWriter.resolve();
      await raceClient.$disconnect();
    }
  });
});
