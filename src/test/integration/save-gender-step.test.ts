import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { POST as bootstrapSession } from "../../app/api/session/route";
import { PATCH } from "../../app/api/assessment/steps/[stepKey]/route";
import { createPrismaClient } from "../../lib/db";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";
const sessionCookieName = "health_assessment_session";
const prisma = createPrismaClient(testDatabaseUrl);

function sessionCookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  const value = setCookie?.match(
    new RegExp(`${sessionCookieName}=([^;]+)`),
  )?.[1];

  if (!value) {
    throw new Error("Expected session cookie.");
  }

  return `${sessionCookieName}=${value}`;
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

describe("PATCH /api/assessment/steps/gender", () => {
  it("persists gender and increments the assessment revision", async () => {
    const bootstrap = await bootstrapSession(
      new NextRequest("http://localhost/api/session", { method: "POST" }),
    );
    const cookie = sessionCookieFrom(bootstrap);

    const response = await PATCH(
      new NextRequest("http://localhost/api/assessment/steps/gender", {
        method: "PATCH",
        headers: {
          cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ value: "MALE", expectedRevision: 0 }),
      }),
      { params: Promise.resolve({ stepKey: "gender" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      saved: true,
      revision: 1,
      nextRequiredStep: "GOAL",
    });

    const persisted = await prisma.assessment.findFirstOrThrow();
    expect(persisted.gender).toBe("MALE");
    expect(persisted.revision).toBe(1);
  });

  it("requires a valid session cookie before mutation", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/assessment/steps/gender", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "MALE", expectedRevision: 0 }),
      }),
      { params: Promise.resolve({ stepKey: "gender" }) },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("SESSION_REQUIRED");
  });

  it("does not treat an unknown client-selected session id as a writable assessment", async () => {
    const unknownSessionId = "22222222-2222-4222-8222-222222222222";

    const response = await PATCH(
      new NextRequest("http://localhost/api/assessment/steps/gender", {
        method: "PATCH",
        headers: {
          cookie: `${sessionCookieName}=${unknownSessionId}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ value: "MALE", expectedRevision: 0 }),
      }),
      { params: Promise.resolve({ stepKey: "gender" }) },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("ASSESSMENT_NOT_FOUND");
  });

  it("rejects an invalid gender before persistence", async () => {
    const bootstrap = await bootstrapSession(
      new NextRequest("http://localhost/api/session", { method: "POST" }),
    );
    const cookie = sessionCookieFrom(bootstrap);

    const response = await PATCH(
      new NextRequest("http://localhost/api/assessment/steps/gender", {
        method: "PATCH",
        headers: {
          cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ value: "NOT_A_GENDER", expectedRevision: 0 }),
      }),
      { params: Promise.resolve({ stepKey: "gender" }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    const persisted = await prisma.assessment.findFirstOrThrow();
    expect(persisted.gender).toBeNull();
    expect(persisted.revision).toBe(0);
  });
});
