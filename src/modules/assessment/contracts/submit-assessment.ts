import { z } from "zod";

export const submitAssessmentRequestSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

export type SubmitAssessmentRequest = z.infer<typeof submitAssessmentRequestSchema>;
