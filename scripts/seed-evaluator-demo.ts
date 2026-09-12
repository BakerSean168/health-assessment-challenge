import { createPrismaClient } from "../src/lib/db";
import { calculateAssessmentResult } from "../src/modules/assessment/domain/calculation";
import { SESSION_COOKIE_NAME } from "../src/modules/session/http/session-cookie";

const FREE_DEMO_SESSION_ID =
  process.env.FREE_DEMO_SESSION_ID ?? "22222222-2222-4222-8222-222222222222";
const ACTIVE_DEMO_SESSION_ID =
  process.env.ACTIVE_DEMO_SESSION_ID ?? "11111111-1111-4111-8111-111111111111";

const referenceDate = new Date("2026-09-11T00:00:00.000Z");
const completedAt = new Date("2026-09-11T12:00:00.000Z");
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

type DemoAccess = "FREE" | "ACTIVE";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed evaluator demo sessions.");
  }

  if (FREE_DEMO_SESSION_ID === ACTIVE_DEMO_SESSION_ID) {
    throw new Error("FREE and ACTIVE evaluator session IDs must be different.");
  }

  const prisma = createPrismaClient(databaseUrl);

  async function seedSession(sessionId: string, access: DemoAccess) {
    await prisma.$transaction(async (tx) => {
      await tx.anonymousSession.upsert({
        where: { id: sessionId },
        update: {},
        create: { id: sessionId },
      });

      await tx.subscription.upsert({
        where: { sessionId },
        update: {
          status: access,
          activatedAt: access === "ACTIVE" ? completedAt : null,
        },
        create: {
          sessionId,
          status: access,
          activatedAt: access === "ACTIVE" ? completedAt : null,
        },
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

      if (access === "ACTIVE") {
        await tx.paymentEvent.upsert({
          where: {
            sessionId_idempotencyKey: {
              sessionId,
              idempotencyKey: "seeded-evaluator-demo",
            },
          },
          update: {},
          create: {
            sessionId,
            idempotencyKey: "seeded-evaluator-demo",
            status: "SUCCEEDED",
          },
        });
      } else {
        // Re-running the fixture restores the published FREE comparison session
        // even if somebody exercised /api/pay with that public demo cookie.
        await tx.paymentEvent.deleteMany({ where: { sessionId } });
      }
    });
  }

  try {
    await seedSession(FREE_DEMO_SESSION_ID, "FREE");
    await seedSession(ACTIVE_DEMO_SESSION_ID, "ACTIVE");

    console.log(`FREE demo sessionId: ${FREE_DEMO_SESSION_ID}`);
    console.log(`FREE cookie: ${SESSION_COOKIE_NAME}=${FREE_DEMO_SESSION_ID}`);
    console.log(`ACTIVE demo sessionId: ${ACTIVE_DEMO_SESSION_ID}`);
    console.log(`ACTIVE cookie: ${SESSION_COOKIE_NAME}=${ACTIVE_DEMO_SESSION_ID}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
