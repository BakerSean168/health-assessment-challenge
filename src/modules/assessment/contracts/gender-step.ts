import { z } from "zod";

export const genderStepRequestSchema = z
  .object({
    value: z.enum(["MALE", "FEMALE", "OTHER"]),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

export type GenderStepRequest = z.infer<typeof genderStepRequestSchema>;
