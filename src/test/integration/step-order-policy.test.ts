import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

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

async function createSession() {
  const response = await bootstrapSession(
    new NextRequest("http://localhost/api/session", { method: "POST" }),
  );
  return cookieFrom(response);
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

describe("server-side assessment step order", () => {
  it("rejects a later unresolved step and does not mutate revision", async () => {
    const cookie = await createSession();
    await saveStep(cookie, "gender", "MALE", 0);

    const skipped = await saveStep(cookie, "height", 175, 1);

    expect(skipped.status).toBe(409);
    await expect(skipped.json()).resolves.toEqual({
      error: {
        code: "STEP_OUT_OF_ORDER",
        message: "This assessment step cannot be submitted yet.",
        details: { nextRequiredStep: "GOAL" },
      },
    });

    const persisted = await prisma.assessment.findFirstOrThrow();
    expect(persisted.heightCm).toBeNull();
    expect(persisted.revision).toBe(1);
  });

  it("allows editing an answered earlier step without losing later valid answers", async () => {
    const cookie = await createSession();
    await saveStep(cookie, "gender", "MALE", 0);
    await saveStep(cookie, "goal", "LOSE_WEIGHT", 1);

    const edited = await saveStep(cookie, "gender", "FEMALE", 2);

    expect(edited.status).toBe(200);
    await expect(edited.json()).resolves.toEqual({
      saved: true,
      revision: 3,
      nextRequiredStep: "ACTIVITY",
    });

    const persisted = await prisma.assessment.findFirstOrThrow();
    expect(persisted.gender).toBe("FEMALE");
    expect(persisted.goal).toBe("LOSE_WEIGHT");
  });

  it("revalidates target weight after an earlier goal edit", async () => {
    const cookie = await createSession();
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
      expect(response.status).toBe(200);
    }

    const changedGoal = await saveStep(cookie, "goal", "GAIN_WEIGHT", 7);
    expect(changedGoal.status).toBe(200);
    await expect(changedGoal.json()).resolves.toEqual({
      saved: true,
      revision: 8,
      nextRequiredStep: "TARGET_WEIGHT",
    });

    const fixedTarget = await saveStep(cookie, "target-weight", 85, 8);
    expect(fixedTarget.status).toBe(200);
    await expect(fixedTarget.json()).resolves.toEqual({
      saved: true,
      revision: 9,
      nextRequiredStep: null,
    });
  });
});
