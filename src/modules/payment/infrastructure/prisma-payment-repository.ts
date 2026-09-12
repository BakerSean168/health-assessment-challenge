import type { PrismaClient } from "../../../generated/prisma/client";
import {
  ACTIVE_SUBSCRIPTION_STATUS,
  FREE_SUBSCRIPTION_STATUS,
} from "../../session/domain/session";
import { SUCCESSFUL_PAYMENT_STATUS } from "../domain/payment";
import type {
  ApplyPaymentResult,
  PaymentRepository,
} from "../application/payment-repository";

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async applySuccessfulPayment(input: {
    sessionId: string;
    idempotencyKey: string;
  }): Promise<ApplyPaymentResult> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.anonymousSession.findUnique({
        where: { id: input.sessionId },
        select: { id: true },
      });

      if (!session) {
        return { kind: "not_found" };
      }

      const insertion = await tx.paymentEvent.createMany({
        data: {
          sessionId: input.sessionId,
          idempotencyKey: input.idempotencyKey,
          status: SUCCESSFUL_PAYMENT_STATUS,
        },
        skipDuplicates: true,
      });

      const replayed = insertion.count === 0;
      const activatedAt = new Date();
      const activation = await tx.subscription.updateMany({
        where: {
          sessionId: input.sessionId,
          status: FREE_SUBSCRIPTION_STATUS,
        },
        data: {
          status: ACTIVE_SUBSCRIPTION_STATUS,
          activatedAt,
        },
      });

      // Normal sessions always have a subscription row. This upsert is a
      // fail-safe for legacy/manual rows and still defaults them to the least
      // privileged state until a successful payment reaches this boundary.
      if (activation.count === 0) {
        const existing = await tx.subscription.findUnique({
          where: { sessionId: input.sessionId },
          select: { status: true },
        });
        if (!existing) {
          await tx.subscription.create({
            data: {
              sessionId: input.sessionId,
              status: ACTIVE_SUBSCRIPTION_STATUS,
              activatedAt,
            },
          });
        }
      }

      return { kind: replayed ? "replayed" : "applied" };
    });
  }
}
