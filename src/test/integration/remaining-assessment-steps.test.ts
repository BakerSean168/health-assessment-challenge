import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "../../app/api/assessment/route";
import { PATCH } from "../../app/api/assessment/steps/[stepKey]/route";
import { POST as bootstrapSession } from "../../app/api/session/route";
import { createPrismaClient } from "../../lib/db";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";
const sessionCookieName = "health_assessment_session";
const prisma = createPrismaClient(testDatabaseUrl);

function cookieFrom(response: Response): string {
  const value = response.headers
    .get("set-cookie")
    ?.match(new RegExp(`${sessionCookieName}=([^;]+)`))?.[1];
  if (!value) throw new Error("Expected session cookie.");
  return `${sessionCookieName}=${value}`;
}

async function saveStep(
  cookie: string,
  stepKey: string,
  value: unknown,
  expectedRevision: number,
) {
  return PATCH(
    new NextRequest(`http://localhost/api/assessment/steps/${stepKey}`, {
      method: "PATCH",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ value, expectedRevision }),
    }),
    { params: Promise.resolve({ stepKey }) },
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

describe("remaining assessment answer contracts", () => {
  it("persists the full seven-answer sequence and derives ready-to-submit state", async () => {
    const bootstrap = await bootstrapSession(
      new NextRequest("http://localhost/api/session", { method: "POST" }),
    );
    const cookie = cookieFrom(bootstrap);

    const sequence = [
      ["gender", "MALE", "GOAL"],
      ["goal", "LOSE_WEIGHT", "ACTIVITY"],
      ["activity", "MODERATE", "HEIGHT"],
      ["height", 175, "WEIGHT"],
      ["weight", 80, "AGE"],
      ["age", 24, "TARGET_WEIGHT"],
      ["target-weight", 72, null],
    ] as const;

    for (const [index, [stepKey, value, expectedNextStep]] of sequence.entries()) {
      const response = await saveStep(cookie, stepKey, value, index);
      expect(response.status, stepKey).toBe(200);
      await expect(response.json()).resolves.toEqual({
        saved: true,
        revision: index + 1,
        nextRequiredStep: expectedNextStep,
      });
    }

    const response = await GET(
      new NextRequest("http://localhost/api/assessment", {
        headers: { cookie },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "IN_PROGRESS",
      nextRequiredStep: null,
      revision: 7,
      answers: {
        gender: "MALE",
        goal: "LOSE_WEIGHT",
        activityLevel: "MODERATE",
        heightCm: 175,
        weightKg: 80,
        age: 24,
        targetWeightKg: 72,
      },
    });
  });

  it("rejects an invalid numeric answer without mutating revision", async () => {
    const bootstrap = await bootstrapSession(
      new NextRequest("http://localhost/api/session", { method: "POST" }),
    );
    const cookie = cookieFrom(bootstrap);

    await saveStep(cookie, "gender", "MALE", 0);
    await saveStep(cookie, "goal", "LOSE_WEIGHT", 1);
    await saveStep(cookie, "activity", "LIGHT", 2);

    const invalid = await saveStep(cookie, "height", 80, 3);
    expect(invalid.status).toBe(400);
    const body = await invalid.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    const persisted = await prisma.assessment.findFirstOrThrow();
    expect(persisted.revision).toBe(3);
  });
});
