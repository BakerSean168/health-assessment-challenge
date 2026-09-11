import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-error";
import { privateJson } from "@/lib/api-response";
import { getPrismaClient } from "@/lib/db";
import { activateSubscription } from "@/modules/payment/application/activate-subscription";
import { payRequestSchema } from "@/modules/payment/contracts/pay";
import { PrismaPaymentRepository } from "@/modules/payment/infrastructure/prisma-payment-repository";
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
      "Start an assessment before unlocking your results.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "PAYMENT_INVALID", "The payment request must be JSON.");
  }

  const parsed = payRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "PAYMENT_INVALID", "The payment request is invalid.", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const result = await activateSubscription(
    {
      sessionId: sessionId.data,
      idempotencyKey: parsed.data.idempotencyKey,
    },
    new PrismaPaymentRepository(getPrismaClient()),
  );

  if (!result.ok) {
    return apiError(404, result.code, "The session was not found.");
  }

  return privateJson({
    status: result.status,
    subscriptionStatus: result.subscriptionStatus,
    replayed: result.replayed,
  });
}
