import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-error";
import { getPrismaClient } from "@/lib/db";
import { getAssessmentResult } from "@/modules/assessment/application/get-assessment-result";
import { PrismaAssessmentResultRepository } from "@/modules/assessment/infrastructure/prisma-assessment-result-repository";
import { SESSION_COOKIE_NAME } from "@/modules/session/http/session-cookie";

const sessionIdSchema = z.uuid();

export async function GET(request: NextRequest) {
  const sessionId = sessionIdSchema.safeParse(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (!sessionId.success) {
    return apiError(
      401,
      "SESSION_REQUIRED",
      "Start an assessment session before loading a result.",
    );
  }

  const result = await getAssessmentResult(
    sessionId.data,
    new PrismaAssessmentResultRepository(getPrismaClient()),
  );

  if (!result.ok) {
    return apiError(404, result.code, "The assessment result was not found.");
  }

  return NextResponse.json(result.result);
}
