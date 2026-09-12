import { z } from "zod";

import { ACTIVE_SUBSCRIPTION_STATUS } from "../../session/domain/session";
import { SUCCESSFUL_PAYMENT_STATUS } from "../domain/payment";

export const payRequestSchema = z
  .object({
    idempotencyKey: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/),
  })
  .strict();

export const payResponseSchema = z
  .object({
    status: z.literal(SUCCESSFUL_PAYMENT_STATUS),
    subscriptionStatus: z.literal(ACTIVE_SUBSCRIPTION_STATUS),
    replayed: z.boolean(),
  })
  .strict();

export type PayRequest = z.infer<typeof payRequestSchema>;
export type PayResponse = z.infer<typeof payResponseSchema>;
