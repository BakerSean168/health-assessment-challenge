import { z } from "zod";

import { assessmentRevisionSchema } from "./primitives";

export const submitAssessmentRequestSchema = z
  .object({
    expectedRevision: assessmentRevisionSchema,
  })
  .strict();

export type SubmitAssessmentRequest = z.infer<typeof submitAssessmentRequestSchema>;
