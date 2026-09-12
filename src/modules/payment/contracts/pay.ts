import { z } from "zod";

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
    status: z.literal("SUCCEEDED"),
    subscriptionStatus: z.literal("ACTIVE"),
    replayed: z.boolean(),
  })
  .strict();

export type PayRequest = z.infer<typeof payRequestSchema>;
export type PayResponse = z.infer<typeof payResponseSchema>;
