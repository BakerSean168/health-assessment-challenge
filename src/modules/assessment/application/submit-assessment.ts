import { ERROR_CODE } from "@/contracts/error-code";
import { assertNever } from "@/lib/assert-never";

import { calculateAssessmentResult } from "../domain/calculation";
import {
  COMPLETED_ASSESSMENT_STATUS,
  type AssessmentStep,
} from "../domain/assessment";
import { validateAssessmentReadyForSubmission } from "../domain/submission";
import type { AssessmentSubmissionRepository } from "./submission-repository";

export interface SubmitAssessmentInput {
  sessionId: string;
  expectedRevision: number;
  referenceDate: Date;
}

export type SubmitAssessmentResult =
  | { ok: true; replayed: boolean }
  | { ok: false; code: typeof ERROR_CODE.ASSESSMENT_NOT_FOUND }
  | { ok: false; code: typeof ERROR_CODE.ASSESSMENT_VERSION_CONFLICT }
  | {
      ok: false;
      code: typeof ERROR_CODE.ASSESSMENT_INCOMPLETE;
      missingSteps: AssessmentStep[];
    };

export async function submitAssessment(
  input: SubmitAssessmentInput,
  repository: AssessmentSubmissionRepository,
): Promise<SubmitAssessmentResult> {
  const state = await repository.findSubmissionState(input.sessionId);

  if (!state) {
    return { ok: false, code: ERROR_CODE.ASSESSMENT_NOT_FOUND };
  }

  if (state.assessment.status === COMPLETED_ASSESSMENT_STATUS) {
    if (!state.hasResult) {
      throw new Error("Completed assessment is missing its canonical result snapshot.");
    }
    return { ok: true, replayed: true };
  }

  if (state.assessment.revision !== input.expectedRevision) {
    return { ok: false, code: ERROR_CODE.ASSESSMENT_VERSION_CONFLICT };
  }

  const validation = validateAssessmentReadyForSubmission(
    state.assessment.answers,
  );
  if (!validation.ready) {
    return {
      ok: false,
      code: ERROR_CODE.ASSESSMENT_INCOMPLETE,
      missingSteps: validation.missingSteps,
    };
  }

  const result = calculateAssessmentResult(
    validation.answers,
    input.referenceDate,
  );
  const persistence = await repository.completeAssessment({
    sessionId: input.sessionId,
    expectedRevision: input.expectedRevision,
    completedAt: input.referenceDate,
    result,
  });

  switch (persistence.kind) {
    case "completed":
      return { ok: true, replayed: false };
    case "replayed":
      return { ok: true, replayed: true };
    case "not_found":
      return { ok: false, code: ERROR_CODE.ASSESSMENT_NOT_FOUND };
    case "conflict":
      return { ok: false, code: ERROR_CODE.ASSESSMENT_VERSION_CONFLICT };
    default:
      return assertNever(persistence, "assessment submission persistence result");
  }
}
