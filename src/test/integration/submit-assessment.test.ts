import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { PATCH } from "../../app/api/assessment/steps/[stepKey]/route";
import { POST as submitAssessment } from "../../app/api/assessment/submit/route";
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

async function createSession() {
  const response = await bootstrapSession(
    new NextRequest("http://localhost/api/session", { method: "POST" }),
  );
  return cookieFrom(response);
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
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ value, expectedRevision }),
    }),
    { params: Promise.resolve({ stepKey }) },
  );
}

async function completeDraft(cookie: string) {
  const sequence = [
    ["gender", "MALE"],
    ["goal", "LOSE_WEIGHT"],
    ["activity", "MODERATE"],
    ["height", 175],
    ["weight", 80],
    ["age", 24],
    ["target-weight", 72],
  ] as const;

  for (const [revision, [stepKey, value]] of sequence.entries()) {
    const response = await saveStep(cookie, stepKey, value, revision);
    expect(response.status, stepKey).toBe(200);
  }
}

function submitRequest(cookie: string, expectedRevision: number) {
  return submitAssessment(
    new NextRequest("http://localhost/api/assessment/submit", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision }),
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

describe("POST /api/assessment/submit", () => {
  it("rejects an incomplete assessment with the unresolved step list", async () => {
    const cookie = await createSession();
    await saveStep(cookie, "gender", "MALE", 0);

    const response = await submitRequest(cookie, 1);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ASSESSMENT_INCOMPLETE",
        message: "Complete all required assessment steps before submitting.",
        details: {
          missingSteps: [
            "GOAL",
            "ACTIVITY",
            "HEIGHT",
            "WEIGHT",
            "AGE",
            "TARGET_WEIGHT",
          ],
        },
      },
    });

    const assessment = await prisma.assessment.findFirstOrThrow();
    expect(assessment.status).toBe("IN_PROGRESS");
    expect(assessment.revision).toBe(1);
  });

  it("creates one versioned result snapshot and completes the aggregate atomically", async () => {
    const cookie = await createSession();
    await completeDraft(cookie);

    const response = await submitRequest(cookie, 7);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "COMPLETED",
      resultReady: true,
    });

    const assessment = await prisma.assessment.findFirstOrThrow({
      include: { result: true },
    });
    expect(assessment.status).toBe("COMPLETED");
    expect(assessment.revision).toBe(8);
    expect(assessment.completedAt).not.toBeNull();
    expect(assessment.result).toMatchObject({
      bmi: 26.1,
      bmiCategory: "OVERWEIGHT",
      recommendedDailyCalories: 2460,
      calculationVersion: "demo-v1",
    });
    expect(assessment.result?.estimatedGoalDate).toBeInstanceOf(Date);
  });

  it("returns the existing snapshot on retry instead of recalculating or duplicating", async () => {
    const cookie = await createSession();
    await completeDraft(cookie);

    const first = await submitRequest(cookie, 7);
    expect(first.status).toBe(200);
    const initialResult = await prisma.assessmentResult.findFirstOrThrow();

    const retry = await submitRequest(cookie, 7);
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toEqual({
      status: "COMPLETED",
      resultReady: true,
    });

    await expect(prisma.assessmentResult.count()).resolves.toBe(1);
    const retriedResult = await prisma.assessmentResult.findFirstOrThrow();
    expect(retriedResult.id).toBe(initialResult.id);
    expect(retriedResult.createdAt).toEqual(initialResult.createdAt);
  });

  it("rejects a stale first-time submit without creating a result", async () => {
    const cookie = await createSession();
    await completeDraft(cookie);

    const edit = await saveStep(cookie, "gender", "FEMALE", 7);
    expect(edit.status).toBe(200);

    const staleSubmit = await submitRequest(cookie, 7);
    expect(staleSubmit.status).toBe(409);
    const body = await staleSubmit.json();
    expect(body.error.code).toBe("ASSESSMENT_VERSION_CONFLICT");

    await expect(prisma.assessmentResult.count()).resolves.toBe(0);
    const assessment = await prisma.assessment.findFirstOrThrow();
    expect(assessment.status).toBe("IN_PROGRESS");
    expect(assessment.revision).toBe(8);
  });
});
