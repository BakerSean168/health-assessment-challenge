import { NextRequest } from "next/server";

import { ERROR_CODE } from "@/contracts/error-code";
import { apiError } from "@/lib/api-error";
import { assertNever } from "@/lib/assert-never";
import { privateJson } from "@/lib/api-response";
import { getPrismaClient } from "@/lib/db";
import { hasJsonContentType } from "@/lib/http-request";
import { submitAssessment } from "@/modules/assessment/application/submit-assessment";
import { submitAssessmentDtoSchema } from "@/modules/assessment/contracts/assessment-api";
import { submitAssessmentRequestSchema } from "@/modules/assessment/contracts/submit-assessment";
import { COMPLETED_ASSESSMENT_STATUS } from "@/modules/assessment/domain/assessment";
import { PrismaAssessmentSubmissionRepository } from "@/modules/assessment/infrastructure/prisma-assessment-submission-repository";
import { sessionIdSchema } from "@/modules/session/contracts/session-id";
import { SESSION_COOKIE_NAME } from "@/modules/session/http/session-cookie";

export async function POST(request: NextRequest) {
  const sessionId = sessionIdSchema.safeParse(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (!sessionId.success) {
    return apiError(
      ERROR_CODE.SESSION_REQUIRED,
      "Start an assessment session before submitting.",
      {},
    );
  }

  if (!hasJsonContentType(request)) {
    return apiError(
      ERROR_CODE.UNSUPPORTED_MEDIA_TYPE,
      "This endpoint requires an application/json request body.",
      {},
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(
      ERROR_CODE.VALIDATION_ERROR,
      "The request body must be JSON.",
      {},
    );
  }

  const parsed = submitAssessmentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ERROR_CODE.VALIDATION_ERROR, "The request is invalid.", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const result = await submitAssessment(
    {
      sessionId: sessionId.data,
      expectedRevision: parsed.data.expectedRevision,
      referenceDate: new Date(),
    },
    new PrismaAssessmentSubmissionRepository(getPrismaClient()),
  );

  if (!result.ok) {
    switch (result.code) {
      case ERROR_CODE.ASSESSMENT_NOT_FOUND:
        return apiError(result.code, "The assessment was not found.", {});
      case ERROR_CODE.ASSESSMENT_INCOMPLETE:
        return apiError(
          result.code,
          "Complete all required assessment steps before submitting.",
          { missingSteps: result.missingSteps },
        );
      case ERROR_CODE.ASSESSMENT_VERSION_CONFLICT:
        return apiError(
          result.code,
          "The assessment changed since this page loaded.",
          {},
        );
      default:
        return assertNever(result, "submit assessment result");
    }
  }

  return privateJson(
    submitAssessmentDtoSchema.parse({
      status: COMPLETED_ASSESSMENT_STATUS,
      resultReady: true,
    }),
  );
}
