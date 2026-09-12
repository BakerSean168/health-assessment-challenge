import { ERROR_CODE } from "@/contracts/error-code";
import { assertNever } from "@/lib/assert-never";

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
      code: typeof ERROR_CODE.SESSION_NOT_FOUND;
    };

export async function activateSubscription(
  input: { sessionId: string; idempotencyKey: string },
  repository: PaymentRepository,
): Promise<ActivateSubscriptionResult> {
  const result = await repository.applySuccessfulPayment(input);

  switch (result.kind) {
    case "applied":
      return {
        ok: true,
        replayed: false,
        status: SUCCESSFUL_PAYMENT_STATUS,
        subscriptionStatus: ACTIVE_SUBSCRIPTION_STATUS,
      };
    case "replayed":
      return {
        ok: true,
        replayed: true,
        status: SUCCESSFUL_PAYMENT_STATUS,
        subscriptionStatus: ACTIVE_SUBSCRIPTION_STATUS,
      };
    case "not_found":
      return { ok: false, code: ERROR_CODE.SESSION_NOT_FOUND };
    default:
      return assertNever(result, "payment persistence result");
  }
}
