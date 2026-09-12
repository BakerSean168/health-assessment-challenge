import {
  getInvalidAssessmentSteps,
  type AssessmentAnswers,
  type AssessmentStep,
  type CompleteAssessmentAnswers,
} from "./assessment";

export type SubmissionValidationResult =
  | {
      ready: true;
      answers: CompleteAssessmentAnswers;
    }
  | {
      ready: false;
      missingSteps: AssessmentStep[];
    };

function isCompleteAssessmentAnswers(
  answers: AssessmentAnswers,
): answers is CompleteAssessmentAnswers {
  return getInvalidAssessmentSteps(answers).length === 0;
}

export function validateAssessmentReadyForSubmission(
  answers: AssessmentAnswers,
): SubmissionValidationResult {
  if (isCompleteAssessmentAnswers(answers)) {
    return { ready: true, answers };
  }

  return {
    ready: false,
    missingSteps: getInvalidAssessmentSteps(answers),
  };
}
