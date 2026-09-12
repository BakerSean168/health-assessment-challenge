import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { privateJson } from "@/lib/api-response";
import { getPrismaClient } from "@/lib/db";
import { getAssessment } from "@/modules/assessment/application/get-assessment";
import { assessmentRecoveryDtoSchema } from "@/modules/assessment/contracts/assessment-api";
import { PrismaAssessmentRepository } from "@/modules/assessment/infrastructure/prisma-assessment-repository";
import { sessionIdSchema } from "@/modules/session/contracts/session-id";
import { SESSION_COOKIE_NAME } from "@/modules/session/http/session-cookie";


export async function GET(request: NextRequest) {
  const sessionId = sessionIdSchema.safeParse(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (!sessionId.success) {
    return apiError("SESSION_REQUIRED",
      "Start an assessment session before loading assessment state.",
      {},
    );
  }

  const result = await getAssessment(
    sessionId.data,
    new PrismaAssessmentRepository(getPrismaClient()),
  );

  if (!result.ok) {
    return apiError(result.code, "The assessment was not found.", {});
  }

  return privateJson(assessmentRecoveryDtoSchema.parse(result.assessment));
}
