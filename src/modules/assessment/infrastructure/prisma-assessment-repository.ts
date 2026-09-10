import type { PrismaClient } from "../../../generated/prisma/client";
import type {
  AssessmentRepository,
  SaveGenderInput,
  SaveGenderPersistenceResult,
} from "../application/assessment-repository";

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
      },
    });

    if (!assessment) {
      return null;
    }

    return {
      id: assessment.id,
      status: assessment.status,
      revision: assessment.revision,
      answers: {
        gender: assessment.gender,
        goal: null,
        activityLevel: null,
        heightCm: null,
        weightKg: null,
        age: null,
        targetWeightKg: null,
      },
    };
  }

  async saveGender(
    input: SaveGenderInput,
  ): Promise<SaveGenderPersistenceResult> {
    const mutation = await this.prisma.assessment.updateMany({
      where: {
        sessionId: input.sessionId,
        status: "IN_PROGRESS",
        revision: input.expectedRevision,
      },
      data: {
        gender: input.gender,
        revision: { increment: 1 },
      },
    });

    if (mutation.count === 1) {
      const assessment = await this.prisma.assessment.findUniqueOrThrow({
        where: { sessionId: input.sessionId },
        select: {
          id: true,
          gender: true,
          revision: true,
          status: true,
        },
      });

      return { kind: "saved", assessment };
    }

    const existing = await this.prisma.assessment.findUnique({
      where: { sessionId: input.sessionId },
      select: { id: true },
    });

    return existing ? { kind: "conflict" } : { kind: "not_found" };
  }
}
