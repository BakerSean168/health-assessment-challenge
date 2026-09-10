import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "../../app/api/pay/route";
import { createPrismaClient } from "../../lib/db";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public";
const sessionCookieName = "health_assessment_session";
const prisma = createPrismaClient(testDatabaseUrl);

async function createSession() {
  return prisma.anonymousSession.create({
    data: { assessment: { create: {} } },
  });
}

function paymentRequest(sessionId: string, idempotencyKey: string) {
  return POST(
    new NextRequest("http://localhost/api/pay", {
      method: "POST",
      headers: {
        cookie: `${sessionCookieName}=${sessionId}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ idempotencyKey }),
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

describe("POST /api/pay", () => {
  it("activates the current session and records one successful event", async () => {
    const session = await createSession();

    const response = await paymentRequest(session.id, "demo_payment_001");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "SUCCEEDED",
      subscriptionStatus: "ACTIVE",
      replayed: false,
    });

    const persisted = await prisma.anonymousSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    expect(persisted.subscriptionStatus).toBe("ACTIVE");
    await expect(prisma.paymentEvent.count()).resolves.toBe(1);
  });

  it("replays the same session-scoped idempotency key without a duplicate effect", async () => {
    const session = await createSession();

    const first = await paymentRequest(session.id, "demo_payment_002");
    expect(first.status).toBe(200);

    const second = await paymentRequest(session.id, "demo_payment_002");
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      status: "SUCCEEDED",
      subscriptionStatus: "ACTIVE",
      replayed: true,
    });

    await expect(prisma.paymentEvent.count()).resolves.toBe(1);
  });

  it("collapses concurrent requests carrying the same idempotency key", async () => {
    const session = await createSession();

    const [first, second] = await Promise.all([
      paymentRequest(session.id, "demo_concurrent_key"),
      paymentRequest(session.id, "demo_concurrent_key"),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const bodies = await Promise.all([first.json(), second.json()]);
    expect(bodies.map((body) => body.replayed).sort()).toEqual([false, true]);
    await expect(prisma.paymentEvent.count()).resolves.toBe(1);
  });

  it("scopes idempotency keys by session", async () => {
    const a = await createSession();
    const b = await createSession();

    const [first, second] = await Promise.all([
      paymentRequest(a.id, "shared_demo_key"),
      paymentRequest(b.id, "shared_demo_key"),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(prisma.paymentEvent.count()).resolves.toBe(2);
  });

  it("requires a valid session and rejects an invalid payment body", async () => {
    const noSession = await POST(
      new NextRequest("http://localhost/api/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey: "demo_payment_003" }),
      }),
    );
    expect(noSession.status).toBe(401);
    expect((await noSession.json()).error.code).toBe("SESSION_REQUIRED");

    const unknown = await paymentRequest(
      "44444444-4444-4444-8444-444444444444",
      "demo_unknown_session",
    );
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).error.code).toBe("SESSION_NOT_FOUND");

    const session = await createSession();
    const invalid = await paymentRequest(session.id, "");
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe("PAYMENT_INVALID");
  });
});
