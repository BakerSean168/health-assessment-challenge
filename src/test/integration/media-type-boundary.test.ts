import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { POST as pay } from "../../app/api/pay/route";
import { PATCH } from "../../app/api/assessment/steps/[stepKey]/route";
import { POST as submit } from "../../app/api/assessment/submit/route";
import { createPrismaClient } from "../../lib/db";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";
const sessionCookieName = "health_assessment_session";
const prisma = createPrismaClient(testDatabaseUrl);

async function createSession() {
  return prisma.anonymousSession.create({
    data: {
      assessment: { create: {} },
      subscription: { create: {} },
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

describe("JSON media-type boundary", () => {
  it("rejects a text/plain step write before parsing or persistence", async () => {
    const session = await createSession();

    const response = await PATCH(
      new NextRequest("http://localhost/api/assessment/steps/gender", {
        method: "PATCH",
        headers: {
          cookie: `${sessionCookieName}=${session.id}`,
          "content-type": "text/plain",
        },
        body: JSON.stringify({ value: "MALE", expectedRevision: 0 }),
      }),
      { params: Promise.resolve({ stepKey: "gender" }) },
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });
    const assessment = await prisma.assessment.findUniqueOrThrow({
      where: { sessionId: session.id },
    });
    expect(assessment.gender).toBeNull();
    expect(assessment.revision).toBe(0);
  });

  it("rejects text/plain submit before interpreting JSON-looking bytes", async () => {
    const session = await createSession();

    const response = await submit(
      new NextRequest("http://localhost/api/assessment/submit", {
        method: "POST",
        headers: {
          cookie: `${sessionCookieName}=${session.id}`,
          "content-type": "text/plain;charset=UTF-8",
        },
        body: JSON.stringify({ expectedRevision: 0 }),
      }),
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });
  });

  it("rejects text/plain payment without creating a payment event", async () => {
    const session = await createSession();

    const response = await pay(
      new NextRequest("http://localhost/api/pay", {
        method: "POST",
        headers: {
          cookie: `${sessionCookieName}=${session.id}`,
          "content-type": "text/plain",
        },
        body: JSON.stringify({ idempotencyKey: "csrf-shaped-simple-request" }),
      }),
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });
    await expect(prisma.paymentEvent.count()).resolves.toBe(0);
    const subscription = await prisma.subscription.findUniqueOrThrow({
      where: { sessionId: session.id },
    });
    expect(subscription.status).toBe("FREE");
  });
});
