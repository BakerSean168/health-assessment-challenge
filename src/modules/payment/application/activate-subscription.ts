import { ACTIVE_SUBSCRIPTION_STATUS } from "../../session/domain/session";
import { SUCCESSFUL_PAYMENT_STATUS } from "../domain/payment";
import type { PaymentRepository } from "./payment-repository";

export type ActivateSubscriptionResult =
  | {
      ok: true;
      replayed: boolean;
      status: typeof SUCCESSFUL_PAYMENT_STATUS;
      subscriptionStatus: typeof ACTIVE_SUBSCRIPTION_STATUS;
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
    status: SUCCESSFUL_PAYMENT_STATUS,
    subscriptionStatus: ACTIVE_SUBSCRIPTION_STATUS,
  };
}
