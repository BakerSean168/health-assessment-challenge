import type { PrismaClient } from "../../../generated/prisma/client";
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
          status: "SUCCEEDED",
        },
        skipDuplicates: true,
      });

      if (insertion.count === 0) {
        return { kind: "replayed" };
      }

      await tx.anonymousSession.update({
        where: { id: input.sessionId },
        data: { subscriptionStatus: "ACTIVE" },
      });

      return { kind: "applied" };
    });
  }
}
