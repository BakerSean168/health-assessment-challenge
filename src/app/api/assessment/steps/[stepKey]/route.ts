import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { privateJson } from "@/lib/api-response";
import { getPrismaClient } from "@/lib/db";
import { hasJsonContentType } from "@/lib/http-request";
import { saveAssessmentStep } from "@/modules/assessment/application/save-assessment-step";
import { saveAssessmentStepDtoSchema } from "@/modules/assessment/contracts/assessment-api";
import { parseAssessmentStepRequest } from "@/modules/assessment/contracts/assessment-step";
import { PrismaAssessmentRepository } from "@/modules/assessment/infrastructure/prisma-assessment-repository";
import { sessionIdSchema } from "@/modules/session/contracts/session-id";
import { SESSION_COOKIE_NAME } from "@/modules/session/http/session-cookie";


type StepRouteContext = {
  params: Promise<{ stepKey: string }>;
};

export async function PATCH(request: NextRequest, context: StepRouteContext) {
  const sessionId = sessionIdSchema.safeParse(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (!sessionId.success) {
    return apiError("SESSION_REQUIRED",
      "Start an assessment session before saving answers.",
      {},
    );
  }

  if (!hasJsonContentType(request)) {
    return apiError(
      "UNSUPPORTED_MEDIA_TYPE",
      "This endpoint requires an application/json request body.",
      {},
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "The request body must be JSON.", {});
  }

  const { stepKey } = await context.params;
  const parsed = parseAssessmentStepRequest(stepKey, body);

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "The request is invalid.", {
      issues: [...parsed.issues],
    });
  }

  const result = await saveAssessmentStep(
    {
      sessionId: sessionId.data,
      ...parsed.data,
    },
    new PrismaAssessmentRepository(getPrismaClient()),
  );

  if (!result.ok && result.code === "ASSESSMENT_NOT_FOUND") {
    return apiError(result.code, "The assessment was not found.", {});
  }

  if (!result.ok && result.code === "STEP_OUT_OF_ORDER") {
    return apiError(result.code,
      "This assessment step cannot be submitted yet.",
      { nextRequiredStep: result.nextRequiredStep },
    );
  }

  if (!result.ok && result.code === "ASSESSMENT_ALREADY_COMPLETED") {
    return apiError(result.code, "The assessment is already completed.", {});
  }

  if (!result.ok && result.code === "STEP_VALUE_INCONSISTENT") {
    return apiError(result.code,
      "The target weight does not match the selected goal.",
      { nextRequiredStep: result.nextRequiredStep },
    );
  }

  if (!result.ok) {
    return apiError(result.code,
      "The assessment changed since this page loaded.",
      {},
    );
  }

  return privateJson(
    saveAssessmentStepDtoSchema.parse({
      saved: true,
      revision: result.revision,
      nextRequiredStep: result.nextRequiredStep,
    }),
  );
}
