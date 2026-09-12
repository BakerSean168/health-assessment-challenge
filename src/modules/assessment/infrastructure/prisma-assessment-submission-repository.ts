import type { PrismaClient } from "../../../generated/prisma/client";
import {
  COMPLETED_ASSESSMENT_STATUS,
  IN_PROGRESS_ASSESSMENT_STATUS,
} from "../domain/assessment";
import type {
  AssessmentSubmissionRepository,
  CompleteAssessmentInput,
  CompleteAssessmentPersistenceResult,
} from "../application/submission-repository";
import { PrismaAssessmentRepository } from "./prisma-assessment-repository";

export class PrismaAssessmentSubmissionRepository
  implements AssessmentSubmissionRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findSubmissionState(sessionId: string) {
    const assessment = await new PrismaAssessmentRepository(
      this.prisma,
    ).findBySessionId(sessionId);

    if (!assessment) {
      return null;
    }

    const result = await this.prisma.assessmentResult.findUnique({
      where: { assessmentId: assessment.id },
      select: { id: true },
    });

    return { assessment, hasResult: result !== null };
  }

  async completeAssessment(
    input: CompleteAssessmentInput,
  ): Promise<CompleteAssessmentPersistenceResult> {
    return this.prisma.$transaction(async (tx) => {
      const mutation = await tx.assessment.updateMany({
        where: {
          sessionId: input.sessionId,
          status: IN_PROGRESS_ASSESSMENT_STATUS,
          revision: input.expectedRevision,
        },
        data: {
          status: COMPLETED_ASSESSMENT_STATUS,
          revision: { increment: 1 },
          completedAt: input.completedAt,
        },
      });

      if (mutation.count === 1) {
        const assessment = await tx.assessment.findUniqueOrThrow({
          where: { sessionId: input.sessionId },
          select: { id: true },
        });

        await tx.assessmentResult.create({
          data: {
            assessmentId: assessment.id,
            bmi: input.result.bmi,
            bmiCategory: input.result.bmiCategory,
            recommendedDailyCalories:
              input.result.recommendedDailyCalories,
            estimatedGoalDate: input.result.estimatedGoalDate,
            calculationVersion: input.result.calculationVersion,
          },
        });

        return { kind: "completed" };
      }

      const existing = await tx.assessment.findUnique({
        where: { sessionId: input.sessionId },
        select: {
          id: true,
          status: true,
          result: { select: { id: true } },
        },
      });

      if (!existing) {
        return { kind: "not_found" };
      }

      if (existing.status === COMPLETED_ASSESSMENT_STATUS && existing.result) {
        return { kind: "replayed" };
      }

      return { kind: "conflict" };
    });
  }
}
