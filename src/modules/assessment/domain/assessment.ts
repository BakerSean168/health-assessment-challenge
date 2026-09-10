export type Gender = "MALE" | "FEMALE" | "OTHER";
export type Goal = "LOSE_WEIGHT" | "MAINTAIN" | "GAIN_WEIGHT";
export type ActivityLevel =
  | "SEDENTARY"
  | "LIGHT"
  | "MODERATE"
  | "ACTIVE"
  | "VERY_ACTIVE";

export type AssessmentStep =
  | "GENDER"
  | "GOAL"
  | "ACTIVITY"
  | "HEIGHT"
  | "WEIGHT"
  | "AGE"
  | "TARGET_WEIGHT";

export interface AssessmentAnswers {
  gender?: Gender | null;
  goal?: Goal | null;
  activityLevel?: ActivityLevel | null;
  heightCm?: number | null;
  weightKg?: number | null;
  age?: number | null;
  targetWeightKg?: number | null;
}


const requiredSteps: ReadonlyArray<{
  step: AssessmentStep;
  isAnswered: (answers: AssessmentAnswers) => boolean;
}> = [
  { step: "GENDER", isAnswered: (answers) => answers.gender != null },
  { step: "GOAL", isAnswered: (answers) => answers.goal != null },
  { step: "ACTIVITY", isAnswered: (answers) => answers.activityLevel != null },
  { step: "HEIGHT", isAnswered: (answers) => answers.heightCm != null },
  { step: "WEIGHT", isAnswered: (answers) => answers.weightKg != null },
  { step: "AGE", isAnswered: (answers) => answers.age != null },
  {
    step: "TARGET_WEIGHT",
    isAnswered: (answers) => answers.targetWeightKg != null,
  },
];

export function getNextRequiredStep(
  answers: AssessmentAnswers,
): AssessmentStep | null {
  return requiredSteps.find(({ isAnswered }) => !isAnswered(answers))?.step ?? null;
}
