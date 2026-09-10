import type { Prisma, PrismaClient } from "../../../generated/prisma/client";
import type {
  AssessmentRepository,
  SaveAssessmentStepInput,
  SaveStepPersistenceResult,
} from "../application/assessment-repository";

function stepMutationData(
  input: SaveAssessmentStepInput,
): Prisma.AssessmentUpdateManyMutationInput {
  switch (input.step) {
    case "GENDER":
      return { gender: input.value, revision: { increment: 1 } };
    case "GOAL":
      return { goal: input.value, revision: { increment: 1 } };
    case "ACTIVITY":
      return { activityLevel: input.value, revision: { increment: 1 } };
    case "HEIGHT":
      return { heightCm: input.value, revision: { increment: 1 } };
    case "WEIGHT":
      return { weightKg: input.value, revision: { increment: 1 } };
    case "AGE":
      return { age: input.value, revision: { increment: 1 } };
    case "TARGET_WEIGHT":
      return { targetWeightKg: input.value, revision: { increment: 1 } };
  }
}

export class PrismaAssessmentRepository implements AssessmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySessionId(sessionId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { sessionId },
      select: {
        id: true,
        status: true,
        revision: true,
        gender: true,
        goal: true,
        activityLevel: true,
        heightCm: true,
        weightKg: true,
        age: true,
        targetWeightKg: true,
      },
    });

    if (!assessment) {
      return null;
    }

    const {
      id,
      status,
      revision,
      gender,
      goal,
      activityLevel,
      heightCm,
      weightKg,
      age,
      targetWeightKg,
    } = assessment;

    return {
      id,
      status,
      revision,
      answers: {
        gender,
        goal,
        activityLevel,
        heightCm,
        weightKg,
        age,
        targetWeightKg,
      },
    };
  }

  async saveStep(
    input: SaveAssessmentStepInput,
  ): Promise<SaveStepPersistenceResult> {
    const mutation = await this.prisma.assessment.updateMany({
      where: {
        sessionId: input.sessionId,
        status: "IN_PROGRESS",
        revision: input.expectedRevision,
      },
      data: stepMutationData(input),
    });

    if (mutation.count === 1) {
      const assessment = await this.findBySessionId(input.sessionId);
      if (!assessment) {
        throw new Error("Assessment disappeared immediately after a successful update.");
      }
      return { kind: "saved", assessment };
    }

    const existing = await this.prisma.assessment.findUnique({
      where: { sessionId: input.sessionId },
      select: { id: true },
    });

    return existing ? { kind: "conflict" } : { kind: "not_found" };
  }
}
