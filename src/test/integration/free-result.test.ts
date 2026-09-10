import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "../../app/api/assessment/result/route";
import { createPrismaClient } from "../../lib/db";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";
const sessionCookieName = "health_assessment_session";
const prisma = createPrismaClient(testDatabaseUrl);

async function seedCompletedFreeSession() {
  return prisma.anonymousSession.create({
    data: {
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
              bmi: 26.1,
              bmiCategory: "OVERWEIGHT",
              recommendedDailyCalories: 2460,
              estimatedGoalDate: new Date("2026-12-31T00:00:00.000Z"),
              calculationVersion: "demo-v1",
            },
          },
        },
      },
    },
  });
}

function requestForSession(sessionId: string) {
  return new NextRequest("http://localhost/api/assessment/result", {
    headers: {
      cookie: `${sessionCookieName}=${sessionId}`,
    },
  });
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

describe("GET /api/assessment/result for FREE sessions", () => {
  it("returns the free projection without premium result values", async () => {
    const session = await seedCompletedFreeSession();

    const response = await GET(requestForSession(session.id));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      access: "FREE",
      bmi: {
        value: 26.1,
        category: "OVERWEIGHT",
      },
      recommendedDailyCalories: { locked: true },
      estimatedGoalDate: { locked: true },
    });

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("2460");
    expect(serialized).not.toContain("2026-12-31");
  });

  it("returns RESULT_NOT_FOUND before an assessment has a result snapshot", async () => {
    const session = await prisma.anonymousSession.create({
      data: { assessment: { create: {} } },
    });

    const response = await GET(requestForSession(session.id));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("RESULT_NOT_FOUND");
  });

  it("requires a valid anonymous session cookie", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/assessment/result"),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("SESSION_REQUIRED");
  });
});
