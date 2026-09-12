import { ERROR_CODE } from "@/contracts/error-code";

import {
  COMPLETED_ASSESSMENT_STATUS,
  getNextRequiredStep,
  type AssessmentAggregateState,
} from "../domain/assessment";
import type { AssessmentRepository, AssessmentState } from "./assessment-repository";

export type AssessmentRecoverySource = Omit<AssessmentAggregateState, "id">;

export function projectAssessmentRecovery(assessment: AssessmentRecoverySource) {
  return {
    status: assessment.status,
    nextRequiredStep:
      assessment.status === COMPLETED_ASSESSMENT_STATUS
        ? null
        : getNextRequiredStep(assessment.answers),
    revision: assessment.revision,
    answers: assessment.answers,
  };
}

export type GetAssessmentResult =
  | {
      ok: true;
      assessment: ReturnType<typeof projectAssessmentRecovery>;
    }
  | {
      ok: false;
      code: typeof ERROR_CODE.ASSESSMENT_NOT_FOUND;
    };

export async function getAssessment(
  sessionId: string,
  repository: AssessmentRepository,
): Promise<GetAssessmentResult> {
  const assessment: AssessmentState | null =
    await repository.findBySessionId(sessionId);

  if (!assessment) {
    return { ok: false, code: ERROR_CODE.ASSESSMENT_NOT_FOUND };
  }

  return {
    ok: true,
    assessment: projectAssessmentRecovery(assessment),
  };
}
