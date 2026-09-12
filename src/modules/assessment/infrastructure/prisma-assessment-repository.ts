import type { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { assessmentAnswerPatchForCommand } from "../contracts/assessment-step";
import { IN_PROGRESS_ASSESSMENT_STATUS } from "../domain/assessment";
import type {
  AssessmentRepository,
  AssessmentState,
  SaveAssessmentStepInput,
  SaveStepPersistenceResult,
} from "../application/assessment-repository";

const assessmentStateSelect = {
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
} as const satisfies Prisma.AssessmentSelect;

type AssessmentStateRow = Prisma.AssessmentGetPayload<{
  select: typeof assessmentStateSelect;
}>;

function toAssessmentState(row: AssessmentStateRow): AssessmentState {
  return {
    id: row.id,
    status: row.status,
    revision: row.revision,
    answers: {
      gender: row.gender,
      goal: row.goal,
      activityLevel: row.activityLevel,
      heightCm: row.heightCm,
      weightKg: row.weightKg,
      age: row.age,
      targetWeightKg: row.targetWeightKg,
    },
  };
}

function stepMutationData(
  input: SaveAssessmentStepInput,
): Prisma.AssessmentUpdateManyMutationInput {
  return {
    ...assessmentAnswerPatchForCommand(input),
    revision: { increment: 1 },
  };
}

export class PrismaAssessmentRepository implements AssessmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySessionId(sessionId: string): Promise<AssessmentState | null> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { sessionId },
      select: assessmentStateSelect,
    });

    return assessment ? toAssessmentState(assessment) : null;
  }

  async saveStep(
    input: SaveAssessmentStepInput,
  ): Promise<SaveStepPersistenceResult> {
    const updated = await this.prisma.assessment.updateManyAndReturn({
      where: {
        sessionId: input.sessionId,
        status: IN_PROGRESS_ASSESSMENT_STATUS,
        revision: input.expectedRevision,
      },
      data: stepMutationData(input),
      select: assessmentStateSelect,
    });

    const [assessment] = updated;
    if (assessment) {
      // updateManyAndReturn gives the exact row produced by this CAS statement.
      // A later writer cannot make this response accidentally report its newer
      // revision, which a separate post-write SELECT could do.
      return { kind: "saved", assessment: toAssessmentState(assessment) };
    }

    const existing = await this.prisma.assessment.findUnique({
      where: { sessionId: input.sessionId },
      select: { id: true },
    });

    return existing ? { kind: "conflict" } : { kind: "not_found" };
  }
}
