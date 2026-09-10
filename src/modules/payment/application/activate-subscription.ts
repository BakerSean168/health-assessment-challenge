import type { PaymentRepository } from "./payment-repository";

export type ActivateSubscriptionResult =
  | {
      ok: true;
      replayed: boolean;
      status: "SUCCEEDED";
      subscriptionStatus: "ACTIVE";
    }
  | {
      ok: false;
      code: "SESSION_NOT_FOUND";
    };

export async function activateSubscription(
  input: { sessionId: string; idempotencyKey: string },
  repository: PaymentRepository,
): Promise<ActivateSubscriptionResult> {
  const result = await repository.applySuccessfulPayment(input);

  if (result.kind === "not_found") {
    return { ok: false, code: "SESSION_NOT_FOUND" };
  }

  return {
    ok: true,
    replayed: result.kind === "replayed",
    status: "SUCCEEDED",
    subscriptionStatus: "ACTIVE",
  };
}
