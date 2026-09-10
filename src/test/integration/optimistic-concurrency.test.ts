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

async function saveGender(cookie: string, value: "MALE" | "FEMALE") {
  return PATCH(
    new NextRequest("http://localhost/api/assessment/steps/gender", {
      method: "PATCH",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ value, expectedRevision: 0 }),
    }),
    { params: Promise.resolve({ stepKey: "gender" }) },
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

describe("optimistic assessment concurrency", () => {
  it("lets exactly one concurrent writer win for the same revision", async () => {
    const bootstrap = await bootstrapSession(
      new NextRequest("http://localhost/api/session", { method: "POST" }),
    );
    const cookie = cookieFrom(bootstrap);

    const [first, second] = await Promise.all([
      saveGender(cookie, "MALE"),
      saveGender(cookie, "FEMALE"),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const conflict = first.status === 409 ? first : second;
    const conflictBody = await conflict.json();
    expect(conflictBody.error.code).toBe("ASSESSMENT_VERSION_CONFLICT");

    const persisted = await prisma.assessment.findFirstOrThrow();
    expect(["MALE", "FEMALE"]).toContain(persisted.gender);
    expect(persisted.revision).toBe(1);
  });

  it("rejects a stale same-value retry instead of hiding stale client state", async () => {
    const bootstrap = await bootstrapSession(
      new NextRequest("http://localhost/api/session", { method: "POST" }),
    );
    const cookie = cookieFrom(bootstrap);

    const first = await saveGender(cookie, "MALE");
    expect(first.status).toBe(200);

    const staleRetry = await saveGender(cookie, "MALE");
    expect(staleRetry.status).toBe(409);
    const body = await staleRetry.json();
    expect(body.error.code).toBe("ASSESSMENT_VERSION_CONFLICT");

    const persisted = await prisma.assessment.findFirstOrThrow();
    expect(persisted.gender).toBe("MALE");
    expect(persisted.revision).toBe(1);
  });
});
