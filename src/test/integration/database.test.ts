import { afterAll, afterEach, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../lib/db";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";

const prisma = createPrismaClient(testDatabaseUrl);

afterEach(async () => {
  await prisma.anonymousSession.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("database integration foundation", () => {
  it("round-trips a persisted anonymous session through PostgreSQL", async () => {
    const created = await prisma.anonymousSession.create({ data: {} });

    const loaded = await prisma.anonymousSession.findUnique({
      where: { id: created.id },
    });

    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(created.id);
    expect(loaded?.subscriptionStatus).toBe("FREE");
  });
});
