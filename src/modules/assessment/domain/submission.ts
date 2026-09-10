import {
  getInvalidAssessmentSteps,
  type ActivityLevel,
  type AssessmentAnswers,
  type AssessmentStep,
  type Gender,
  type Goal,
} from "./assessment";

export interface CompleteAssessmentAnswers {
  gender: Gender;
  goal: Goal;
  activityLevel: ActivityLevel;
  heightCm: number;
  weightKg: number;
  age: number;
  targetWeightKg: number;
}

export type SubmissionValidationResult =
  | {
      ready: true;
      answers: CompleteAssessmentAnswers;
    }
  | {
      ready: false;
      missingSteps: AssessmentStep[];
    };

export function validateAssessmentReadyForSubmission(
  answers: AssessmentAnswers,
): SubmissionValidationResult {
  const missingSteps = getInvalidAssessmentSteps(answers);

  if (missingSteps.length > 0) {
    return { ready: false, missingSteps };
  }

  return {
    ready: true,
    answers: answers as CompleteAssessmentAnswers,
  };
}
