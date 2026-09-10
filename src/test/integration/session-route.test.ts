import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { createPrismaClient } from "../../lib/db";
import { POST } from "../../app/api/session/route";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";

const prisma = createPrismaClient(testDatabaseUrl);
const sessionCookieName = "health_assessment_session";

function extractCookieValue(setCookie: string): string {
  const match = setCookie.match(
    new RegExp(`${sessionCookieName}=([^;]+)`),
  );

  if (!match?.[1]) {
    throw new Error("Session cookie was not present in Set-Cookie.");
  }

  return match[1];
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

describe("POST /api/session", () => {
  it("creates one server-owned session and its assessment for a fresh browser", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/session", { method: "POST" }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      subscriptionStatus: "FREE",
      assessment: {
        status: "IN_PROGRESS",
        nextRequiredStep: "GENDER",
        revision: 0,
      },
    });

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/");

    const sessionId = extractCookieValue(setCookie!);
    const persisted = await prisma.anonymousSession.findUnique({
      where: { id: sessionId },
      include: { assessment: true },
    });

    expect(persisted?.subscriptionStatus).toBe("FREE");
    expect(persisted?.assessment).toMatchObject({
      status: "IN_PROGRESS",
      revision: 0,
    });
  });

  it("reuses the same persisted session when the browser sends its cookie again", async () => {
    const first = await POST(
      new NextRequest("http://localhost/api/session", { method: "POST" }),
    );
    const sessionId = extractCookieValue(first.headers.get("set-cookie")!);

    const second = await POST(
      new NextRequest("http://localhost/api/session", {
        method: "POST",
        headers: {
          cookie: `${sessionCookieName}=${sessionId}`,
        },
      }),
    );

    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      subscriptionStatus: "FREE",
      assessment: {
        status: "IN_PROGRESS",
        nextRequiredStep: "GENDER",
        revision: 0,
      },
    });

    await expect(prisma.anonymousSession.count()).resolves.toBe(1);
    await expect(prisma.assessment.count()).resolves.toBe(1);
  });

  it("replaces an unknown session cookie instead of trusting client-selected identity", async () => {
    const unknownSessionId = "11111111-1111-4111-8111-111111111111";

    const response = await POST(
      new NextRequest("http://localhost/api/session", {
        method: "POST",
        headers: {
          cookie: `${sessionCookieName}=${unknownSessionId}`,
        },
      }),
    );

    expect(response.status).toBe(201);
    const issuedSessionId = extractCookieValue(response.headers.get("set-cookie")!);
    expect(issuedSessionId).not.toBe(unknownSessionId);
    await expect(prisma.anonymousSession.count()).resolves.toBe(1);
    await expect(prisma.assessment.count()).resolves.toBe(1);
  });
});
