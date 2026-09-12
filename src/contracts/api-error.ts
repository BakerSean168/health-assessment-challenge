import { z } from "zod";

import { ASSESSMENT_STEP_VALUES } from "@/modules/assessment/domain/assessment";

const validationIssueSchema = z
  .object({
    path: z.string(),
    message: z.string(),
  })
  .strict();

const emptyDetailsSchema = z.object({}).strict();
const assessmentStepSchema = z.enum(ASSESSMENT_STEP_VALUES);

function errorVariant<Code extends string, Details extends z.ZodType>(
  code: Code,
  details: Details,
) {
  return z
    .object({
      code: z.literal(code),
      message: z.string(),
      details,
    })
    .strict();
}

const apiErrorSchema = z.discriminatedUnion("code", [
  errorVariant("SESSION_REQUIRED", emptyDetailsSchema),
  errorVariant("SESSION_NOT_FOUND", emptyDetailsSchema),
  errorVariant(
    "VALIDATION_ERROR",
    z.object({ issues: z.array(validationIssueSchema).optional() }).strict(),
  ),
  errorVariant(
    "PAYMENT_INVALID",
    z.object({ issues: z.array(validationIssueSchema).optional() }).strict(),
  ),
  errorVariant("ASSESSMENT_NOT_FOUND", emptyDetailsSchema),
  errorVariant(
    "ASSESSMENT_INCOMPLETE",
    z.object({ missingSteps: z.array(assessmentStepSchema) }).strict(),
  ),
  errorVariant("ASSESSMENT_VERSION_CONFLICT", emptyDetailsSchema),
  errorVariant("ASSESSMENT_ALREADY_COMPLETED", emptyDetailsSchema),
  errorVariant(
    "STEP_OUT_OF_ORDER",
    z.object({ nextRequiredStep: assessmentStepSchema.nullable() }).strict(),
  ),
  errorVariant(
    "STEP_VALUE_INCONSISTENT",
    z.object({ nextRequiredStep: z.literal("TARGET_WEIGHT") }).strict(),
  ),
  errorVariant("RESULT_NOT_FOUND", emptyDetailsSchema),
]);

export const apiErrorEnvelopeSchema = z.object({ error: apiErrorSchema }).strict();

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
export type ApiError = ApiErrorEnvelope["error"];
export type ApiErrorCode = ApiError["code"];
export type ApiErrorDetails<Code extends ApiErrorCode> = Extract<
  ApiError,
  { code: Code }
>["details"];

export const API_ERROR_STATUS_BY_CODE = {
  SESSION_REQUIRED: 401,
  SESSION_NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  PAYMENT_INVALID: 400,
  ASSESSMENT_NOT_FOUND: 404,
  ASSESSMENT_INCOMPLETE: 409,
  ASSESSMENT_VERSION_CONFLICT: 409,
  ASSESSMENT_ALREADY_COMPLETED: 409,
  STEP_OUT_OF_ORDER: 409,
  STEP_VALUE_INCONSISTENT: 422,
  RESULT_NOT_FOUND: 404,
} as const satisfies Record<ApiErrorCode, number>;
