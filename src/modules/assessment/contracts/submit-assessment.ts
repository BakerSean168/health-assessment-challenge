import { z } from "zod";

export const submitAssessmentRequestSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
