import { afterAll, afterEach, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../lib/db";
import { ASSESSMENT_INPUT_LIMITS } from "../../modules/assessment/domain/input-limits";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";
const prisma = createPrismaClient(testDatabaseUrl);

async function createSession() {
  return prisma.anonymousSession.create({
    data: {
      assessment: { create: {} },
      subscription: { create: {} },
    },
  });
}

afterEach(async () => {
  await prisma.anonymousSession.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("database invariant backstop", () => {
  it("accepts the exact scalar bounds owned by the domain", async () => {
    const session = await createSession();

    await expect(
      prisma.assessment.update({
        where: { sessionId: session.id },
        data: {
          heightCm: ASSESSMENT_INPUT_LIMITS.heightCm.min,
          weightKg: ASSESSMENT_INPUT_LIMITS.weightKg.max,
          targetWeightKg: ASSESSMENT_INPUT_LIMITS.targetWeightKg.max,
          age: ASSESSMENT_INPUT_LIMITS.age.min,
        },
      }),
    ).resolves.toMatchObject({
      heightCm: ASSESSMENT_INPUT_LIMITS.heightCm.min,
      weightKg: ASSESSMENT_INPUT_LIMITS.weightKg.max,
      targetWeightKg: ASSESSMENT_INPUT_LIMITS.targetWeightKg.max,
      age: ASSESSMENT_INPUT_LIMITS.age.min,
    });
  });

  it("rejects out-of-contract scalar answers even through direct persistence writes", async () => {
    const session = await createSession();
    const invalidPatches = [
      { heightCm: ASSESSMENT_INPUT_LIMITS.heightCm.min - 0.1 },
      { weightKg: ASSESSMENT_INPUT_LIMITS.weightKg.max + 0.1 },
      { targetWeightKg: ASSESSMENT_INPUT_LIMITS.targetWeightKg.min - 0.1 },
      { age: ASSESSMENT_INPUT_LIMITS.age.max + 1 },
    ] as const;

    for (const data of invalidPatches) {
      await expect(
        prisma.assessment.update({
          where: { sessionId: session.id },
          data,
        }),
      ).rejects.toThrow();
    }
  });

  it("rejects a negative optimistic-concurrency revision", async () => {
    const session = await createSession();

    await expect(
      prisma.assessment.update({
        where: { sessionId: session.id },
        data: { revision: -1 },
      }),
    ).rejects.toThrow();
  });

  it("requires completed assessments to carry a completion timestamp", async () => {
    const session = await createSession();

    await expect(
      prisma.assessment.update({
        where: { sessionId: session.id },
        data: { status: "COMPLETED", completedAt: null },
      }),
    ).rejects.toThrow();
  });

  it("keeps subscription status and activation timestamp consistent", async () => {
    const session = await createSession();

    await expect(
      prisma.subscription.update({
        where: { sessionId: session.id },
        data: { status: "ACTIVE", activatedAt: null },
      }),
    ).rejects.toThrow();
  });

  it("rejects malformed idempotency keys outside the HTTP validator too", async () => {
    const session = await createSession();

    for (const idempotencyKey of ["", "contains space"]) {
      await expect(
        prisma.paymentEvent.create({
          data: {
            sessionId: session.id,
            idempotencyKey,
            status: "SUCCEEDED",
          },
        }),
      ).rejects.toThrow();
    }
  });

  it("rejects structurally impossible result snapshots", async () => {
    const session = await createSession();
    const completedAt = new Date("2026-09-12T00:00:00.000Z");
    const assessment = await prisma.assessment.update({
      where: { sessionId: session.id },
      data: { status: "COMPLETED", completedAt },
    });
    const base = {
      assessmentId: assessment.id,
      bmi: 24.5,
      bmiCategory: "NORMAL" as const,
      recommendedDailyCalories: 2000,
      estimatedGoalDate: new Date("2026-09-12T00:00:00.000Z"),
      calculationVersion: "demo-v1",
    };

    await expect(
      prisma.assessmentResult.create({ data: { ...base, bmi: 0 } }),
    ).rejects.toThrow();
    await expect(
      prisma.assessmentResult.create({
        data: { ...base, recommendedDailyCalories: 0 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.assessmentResult.create({
        data: { ...base, calculationVersion: "" },
      }),
    ).rejects.toThrow();
  });
});
