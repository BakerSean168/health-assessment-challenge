import { NextRequest } from "next/server";

import { privateJson } from "@/lib/api-response";

import { getPrismaClient } from "@/lib/db";
import { getNextRequiredStep } from "@/modules/assessment/domain/assessment";
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
    { existingSessionId },
    repository,
  );

  if (!session.assessment) {
    throw new Error("Session bootstrap completed without an assessment.");
  }

  const response = privateJson(
    {
      orderId: session.assessment.id,
      subscriptionStatus: session.subscriptionStatus,
      assessment: {
        status: session.assessment.status,
        nextRequiredStep:
          session.assessment.status === "IN_PROGRESS"
            ? getNextRequiredStep(session.assessment)
            : null,
        revision: session.assessment.revision,
        answers: {
          gender: session.assessment.gender,
          goal: session.assessment.goal,
          activityLevel: session.assessment.activityLevel,
          heightCm: session.assessment.heightCm,
          weightKg: session.assessment.weightKg,
          age: session.assessment.age,
          targetWeightKg: session.assessment.targetWeightKg,
        },
      },
    },
    { status: created ? 201 : 200 },
  );

  response.cookies.set(
    SESSION_COOKIE_NAME,
    session.id,
    getSessionCookieOptions(),
  );

  return response;
}
