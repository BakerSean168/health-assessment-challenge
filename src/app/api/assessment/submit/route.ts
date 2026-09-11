import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-error";
import { privateJson } from "@/lib/api-response";
import { getPrismaClient } from "@/lib/db";
import { submitAssessment } from "@/modules/assessment/application/submit-assessment";
import { submitAssessmentRequestSchema } from "@/modules/assessment/contracts/submit-assessment";
import { PrismaAssessmentSubmissionRepository } from "@/modules/assessment/infrastructure/prisma-assessment-submission-repository";
import { SESSION_COOKIE_NAME } from "@/modules/session/http/session-cookie";

const sessionIdSchema = z.uuid();

export async function POST(request: NextRequest) {
  const sessionId = sessionIdSchema.safeParse(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (!sessionId.success) {
    return apiError(
      401,
      "SESSION_REQUIRED",
      "Start an assessment session before submitting.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "The request body must be JSON.");
  }

  const parsed = submitAssessmentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "The request is invalid.", {
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

  if (!result.ok && result.code === "ASSESSMENT_NOT_FOUND") {
    return apiError(404, result.code, "The assessment was not found.");
  }

  if (!result.ok && result.code === "ASSESSMENT_INCOMPLETE") {
    return apiError(
      409,
      result.code,
      "Complete all required assessment steps before submitting.",
      { missingSteps: result.missingSteps },
    );
  }

  if (!result.ok) {
    return apiError(
      409,
      result.code,
      "The assessment changed since this page loaded.",
    );
  }

  return privateJson({
    status: "COMPLETED",
    resultReady: true,
  });
}
