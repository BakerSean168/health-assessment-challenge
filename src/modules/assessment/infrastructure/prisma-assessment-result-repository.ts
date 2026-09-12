import type { PrismaClient } from "../../../generated/prisma/client";
import type {
  AssessmentResultRepository,
  ResultReadModel,
} from "../application/result-repository";

export class PrismaAssessmentResultRepository
  implements AssessmentResultRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findBySessionId(sessionId: string): Promise<ResultReadModel | null> {
    const session = await this.prisma.anonymousSession.findUnique({
      where: { id: sessionId },
      select: {
        subscription: { select: { status: true } },
        assessment: {
          select: {
            result: {
              select: {
                bmi: true,
                bmiCategory: true,
                recommendedDailyCalories: true,
                estimatedGoalDate: true,
              },
            },
          },
        },
      },
    });

    if (!session?.assessment?.result) {
      return null;
    }

    return {
      // Fail closed if a manually-created/corrupt session somehow lacks the
      // expected 1:1 subscription row.
      subscriptionStatus: session.subscription?.status ?? "FREE",
      result: session.assessment.result,
    };
  }
}
