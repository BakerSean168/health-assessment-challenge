import { randomUUID } from "node:crypto";

import { createPrismaClient } from "../src/lib/db";
import { calculateAssessmentResult } from "../src/modules/assessment/domain/calculation";
import { SESSION_COOKIE_NAME } from "../src/modules/session/http/session-cookie";

const sessionId = process.env.DEMO_SESSION_ID ?? randomUUID();
const referenceDate = new Date("2026-09-11T00:00:00.000Z");
const completedAt = new Date();
const answers = {
  gender: "MALE" as const,
  goal: "LOSE_WEIGHT" as const,
  activityLevel: "MODERATE" as const,
  heightCm: 175,
  weightKg: 75,
  age: 24,
  targetWeightKg: 68,
};
const result = calculateAssessmentResult(answers, referenceDate);
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed the paid demo session.");
  }

  const prisma = createPrismaClient(databaseUrl);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.anonymousSession.upsert({
        where: { id: sessionId },
        update: {},
        create: { id: sessionId },
      });

      await tx.subscription.upsert({
        where: { sessionId },
        update: { status: "ACTIVE", activatedAt: completedAt },
        create: { sessionId, status: "ACTIVE", activatedAt: completedAt },
      });

      const assessment = await tx.assessment.upsert({
        where: { sessionId },
        update: {
          ...answers,
          status: "COMPLETED",
          revision: 8,
          completedAt,
        },
        create: {
          sessionId,
          ...answers,
          status: "COMPLETED",
          revision: 8,
          completedAt,
        },
      });

      await tx.assessmentResult.upsert({
        where: { assessmentId: assessment.id },
        update: {
          bmi: result.bmi,
          bmiCategory: result.bmiCategory,
          recommendedDailyCalories: result.recommendedDailyCalories,
          estimatedGoalDate: result.estimatedGoalDate,
          calculationVersion: result.calculationVersion,
        },
        create: {
          assessmentId: assessment.id,
          bmi: result.bmi,
          bmiCategory: result.bmiCategory,
          recommendedDailyCalories: result.recommendedDailyCalories,
          estimatedGoalDate: result.estimatedGoalDate,
          calculationVersion: result.calculationVersion,
        },
      });

      await tx.paymentEvent.upsert({
        where: {
          sessionId_idempotencyKey: {
            sessionId,
            idempotencyKey: "seeded-paid-demo",
          },
        },
        update: {},
        create: {
          sessionId,
          idempotencyKey: "seeded-paid-demo",
          status: "SUCCEEDED",
        },
      });
    });

    console.log(`Paid demo sessionId: ${sessionId}`);
    console.log(`Cookie: ${SESSION_COOKIE_NAME}=${sessionId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
