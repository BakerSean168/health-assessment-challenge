import { describe, expect, it } from "vitest";

import { payRequestSchema } from "./pay";

describe("simulated payment contract", () => {
  it("accepts a bounded idempotency key", () => {
    expect(
      payRequestSchema.safeParse({ idempotencyKey: "demo_01J_TEST" }).success,
    ).toBe(true);
  });

  it("rejects empty/oversized keys and extra fields", () => {
    expect(payRequestSchema.safeParse({ idempotencyKey: "" }).success).toBe(
      false,
    );
    expect(
      payRequestSchema.safeParse({ idempotencyKey: "x".repeat(129) }).success,
    ).toBe(false);
    expect(
      payRequestSchema.safeParse({
        idempotencyKey: "demo_01J_TEST",
        sessionId: "client-controlled",
      }).success,
    ).toBe(false);
  });
});
