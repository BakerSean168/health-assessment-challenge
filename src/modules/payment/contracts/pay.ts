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

export type PayRequest = z.infer<typeof payRequestSchema>;
