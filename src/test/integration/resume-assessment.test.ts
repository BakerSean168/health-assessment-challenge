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

  if (!value) {
    throw new Error("Expected session cookie.");
  }

  return `${sessionCookieName}=${value}`;
}

interface TestRequestInit {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit;
}

function requestWithCookie(
  url: string,
  cookie: string,
  init: TestRequestInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);

  return new NextRequest(url, {
    method: init.method,
    headers,
    body: init.body,
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

describe("assessment recovery", () => {
  it("restores persisted answers and derives the next required step", async () => {
    const bootstrap = await bootstrapSession(
      new NextRequest("http://localhost/api/session", { method: "POST" }),
    );
    const cookie = cookieFrom(bootstrap);

    const save = await PATCH(
      requestWithCookie(
        "http://localhost/api/assessment/steps/gender",
        cookie,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value: "FEMALE", expectedRevision: 0 }),
        },
      ),
      { params: Promise.resolve({ stepKey: "gender" }) },
    );
    expect(save.status).toBe(200);

    const response = await GET(
      requestWithCookie("http://localhost/api/assessment", cookie),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "IN_PROGRESS",
      nextRequiredStep: "GOAL",
      revision: 1,
      answers: {
        gender: "FEMALE",
        goal: null,
        activityLevel: null,
        heightCm: null,
        weightKg: null,
        age: null,
        targetWeightKg: null,
      },
    });
  });

  it("returns the derived progress when session bootstrap is retried after an answer", async () => {
    const bootstrap = await bootstrapSession(
      new NextRequest("http://localhost/api/session", { method: "POST" }),
    );
    const cookie = cookieFrom(bootstrap);

    await PATCH(
      requestWithCookie(
        "http://localhost/api/assessment/steps/gender",
        cookie,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value: "MALE", expectedRevision: 0 }),
        },
      ),
      { params: Promise.resolve({ stepKey: "gender" }) },
    );

    const response = await bootstrapSession(
      requestWithCookie("http://localhost/api/session", cookie, {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orderId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(body.assessment).toEqual({
      status: "IN_PROGRESS",
      nextRequiredStep: "GOAL",
      revision: 1,
      answers: {
        gender: "MALE",
        goal: null,
        activityLevel: null,
        heightCm: null,
        weightKg: null,
        age: null,
        targetWeightKg: null,
      },
    });
  });

  it("requires a valid session cookie", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/assessment"),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("SESSION_REQUIRED");
  });

  it("returns not found for an unknown session identity", async () => {
    const cookie = `${sessionCookieName}=33333333-3333-4333-8333-333333333333`;
    const response = await GET(
      requestWithCookie("http://localhost/api/assessment", cookie),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("ASSESSMENT_NOT_FOUND");
  });
});
