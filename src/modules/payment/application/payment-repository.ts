export type ApplyPaymentResult =
  | { kind: "applied" }
  | { kind: "replayed" }
  | { kind: "not_found" };

export interface PaymentRepository {
  applySuccessfulPayment(input: {
    sessionId: string;
    idempotencyKey: string;
  }): Promise<ApplyPaymentResult>;
}
