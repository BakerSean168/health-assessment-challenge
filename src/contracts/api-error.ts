import { z } from "zod";

import { ERROR_CODE } from "@/contracts/error-code";
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
  errorVariant(ERROR_CODE.SESSION_REQUIRED, emptyDetailsSchema),
  errorVariant(ERROR_CODE.SESSION_NOT_FOUND, emptyDetailsSchema),
  errorVariant(ERROR_CODE.UNSUPPORTED_MEDIA_TYPE, emptyDetailsSchema),
  errorVariant(
    ERROR_CODE.VALIDATION_ERROR,
    z.object({ issues: z.array(validationIssueSchema).optional() }).strict(),
  ),
  errorVariant(
    ERROR_CODE.PAYMENT_INVALID,
    z.object({ issues: z.array(validationIssueSchema).optional() }).strict(),
  ),
  errorVariant(ERROR_CODE.ASSESSMENT_NOT_FOUND, emptyDetailsSchema),
  errorVariant(
    ERROR_CODE.ASSESSMENT_INCOMPLETE,
    z.object({ missingSteps: z.array(assessmentStepSchema) }).strict(),
  ),
  errorVariant(ERROR_CODE.ASSESSMENT_VERSION_CONFLICT, emptyDetailsSchema),
  errorVariant(ERROR_CODE.ASSESSMENT_ALREADY_COMPLETED, emptyDetailsSchema),
  errorVariant(
    ERROR_CODE.STEP_OUT_OF_ORDER,
    z.object({ nextRequiredStep: assessmentStepSchema.nullable() }).strict(),
  ),
  errorVariant(
    ERROR_CODE.STEP_VALUE_INCONSISTENT,
    z.object({ nextRequiredStep: z.literal("TARGET_WEIGHT") }).strict(),
  ),
  errorVariant(ERROR_CODE.RESULT_NOT_FOUND, emptyDetailsSchema),
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
  [ERROR_CODE.SESSION_REQUIRED]: 401,
  [ERROR_CODE.SESSION_NOT_FOUND]: 404,
  [ERROR_CODE.UNSUPPORTED_MEDIA_TYPE]: 415,
  [ERROR_CODE.VALIDATION_ERROR]: 400,
  [ERROR_CODE.PAYMENT_INVALID]: 400,
  [ERROR_CODE.ASSESSMENT_NOT_FOUND]: 404,
  [ERROR_CODE.ASSESSMENT_INCOMPLETE]: 409,
  [ERROR_CODE.ASSESSMENT_VERSION_CONFLICT]: 409,
  [ERROR_CODE.ASSESSMENT_ALREADY_COMPLETED]: 409,
  [ERROR_CODE.STEP_OUT_OF_ORDER]: 409,
  [ERROR_CODE.STEP_VALUE_INCONSISTENT]: 422,
  [ERROR_CODE.RESULT_NOT_FOUND]: 404,
} as const satisfies Record<ApiErrorCode, number>;
