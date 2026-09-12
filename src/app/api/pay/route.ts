import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { privateJson } from "@/lib/api-response";
import { getPrismaClient } from "@/lib/db";
import { hasJsonContentType } from "@/lib/http-request";
import { activateSubscription } from "@/modules/payment/application/activate-subscription";
import {
  payRequestSchema,
  payResponseSchema,
} from "@/modules/payment/contracts/pay";
import { PrismaPaymentRepository } from "@/modules/payment/infrastructure/prisma-payment-repository";
import { sessionIdSchema } from "@/modules/session/contracts/session-id";
import { SESSION_COOKIE_NAME } from "@/modules/session/http/session-cookie";


export async function POST(request: NextRequest) {
  const sessionId = sessionIdSchema.safeParse(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (!sessionId.success) {
    return apiError("SESSION_REQUIRED",
      "Start an assessment before unlocking your results.",
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
    return apiError("PAYMENT_INVALID", "The payment request must be JSON.", {});
  }

  const parsed = payRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("PAYMENT_INVALID", "The payment request is invalid.", {
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
    return apiError(result.code, "The session was not found.", {});
  }

  return privateJson(
    payResponseSchema.parse({
      status: result.status,
      subscriptionStatus: result.subscriptionStatus,
      replayed: result.replayed,
    }),
  );
}
