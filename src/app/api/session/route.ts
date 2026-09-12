import { NextRequest } from "next/server";

import { privateJson } from "@/lib/api-response";

import { getPrismaClient } from "@/lib/db";
import { projectAssessmentRecovery } from "@/modules/assessment/application/get-assessment";
import { sessionBootstrapDtoSchema } from "@/modules/assessment/contracts/assessment-api";
import { ensureAnonymousSession } from "@/modules/session/application/ensure-anonymous-session";
import { PrismaAnonymousSessionRepository } from "@/modules/session/infrastructure/prisma-anonymous-session-repository";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/modules/session/http/session-cookie";

export async function POST(request: NextRequest) {
  const repository = new PrismaAnonymousSessionRepository(getPrismaClient());
  const existingSessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const { session, created } = await ensureAnonymousSession(
    existingSessionId ? { existingSessionId } : {},
    repository,
  );

  if (!session.assessment) {
    throw new Error("Session bootstrap completed without an assessment.");
  }

  const response = privateJson(
    sessionBootstrapDtoSchema.parse({
      orderId: session.assessment.id,
      subscriptionStatus: session.subscriptionStatus,
      assessment: projectAssessmentRecovery(session.assessment),
    }),
    { status: created ? 201 : 200 },
  );

  response.cookies.set(
    SESSION_COOKIE_NAME,
    session.id,
    getSessionCookieOptions(),
  );

  return response;
}
