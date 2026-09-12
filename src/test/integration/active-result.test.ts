import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "../../app/api/assessment/result/route";
import { POST as pay } from "../../app/api/pay/route";
import { createPrismaClient } from "../../lib/db";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";
const sessionCookieName = "health_assessment_session";
const prisma = createPrismaClient(testDatabaseUrl);

async function seedCompletedFreeSession() {
  return prisma.anonymousSession.create({
    data: {
      subscription: { create: {} },
      assessment: {
        create: {
          status: "COMPLETED",
          revision: 8,
          gender: "MALE",
          goal: "LOSE_WEIGHT",
          activityLevel: "MODERATE",
          heightCm: 175,
          weightKg: 80,
          age: 24,
          targetWeightKg: 72,
          completedAt: new Date("2026-09-10T12:00:00.000Z"),
          result: {
            create: {
              bmi: 25.8,
              bmiCategory: "OVERWEIGHT",
              recommendedDailyCalories: 1990,
              estimatedGoalDate: new Date("2030-01-02T00:00:00.000Z"),
              calculationVersion: "stored-test-snapshot",
            },
          },
        },
      },
    },
    include: {
      assessment: {
        include: { result: true },
      },
    },
  });
}

function resultRequest(sessionId: string) {
  return GET(
    new NextRequest("http://localhost/api/assessment/result", {
      headers: { cookie: `${sessionCookieName}=${sessionId}` },
    }),
  );
}

function payRequest(sessionId: string) {
  return pay(
    new NextRequest("http://localhost/api/pay", {
      method: "POST",
      headers: {
        cookie: `${sessionCookieName}=${sessionId}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ idempotencyKey: "unlock_result_test" }),
    }),
  );
}

beforeAll(() => {
  process.env.DATABASE_URL = testDatabaseUrl;
});

afterEach(async () => {
  await prisma.anonymousSession.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("ACTIVE result projection", () => {
  it("unlocks the same stored snapshot after payment without recalculation", async () => {
    const session = await seedCompletedFreeSession();
    const snapshot = session.assessment?.result;
    if (!snapshot) throw new Error("Expected seeded result snapshot.");

    const before = await resultRequest(session.id);
    expect(before.status).toBe(200);
    expect((await before.json()).access).toBe("FREE");

    const payment = await payRequest(session.id);
    expect(payment.status).toBe(200);

    const after = await resultRequest(session.id);
    expect(after.status).toBe(200);
    await expect(after.json()).resolves.toEqual({
      access: "ACTIVE",
      bmi: { value: 25.8, category: "OVERWEIGHT" },
      recommendedDailyCalories: { locked: false, value: 1990 },
      estimatedGoalDate: { locked: false, value: "2030-01-02" },
    });

    const persisted = await prisma.assessmentResult.findFirstOrThrow();
    expect(persisted.id).toBe(snapshot.id);
    expect(persisted.createdAt).toEqual(snapshot.createdAt);
    await expect(prisma.assessmentResult.count()).resolves.toBe(1);
  });
});
