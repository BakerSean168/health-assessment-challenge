import { ASSESSMENT_INPUT_LIMITS } from "./input-limits";

export const GENDER_VALUES = ["MALE", "FEMALE", "OTHER"] as const;
export type Gender = (typeof GENDER_VALUES)[number];

export const GOAL_VALUES = ["LOSE_WEIGHT", "MAINTAIN", "GAIN_WEIGHT"] as const;
export type Goal = (typeof GOAL_VALUES)[number];

export const ACTIVITY_LEVEL_VALUES = [
  "SEDENTARY",
  "LIGHT",
  "MODERATE",
  "ACTIVE",
  "VERY_ACTIVE",
] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVEL_VALUES)[number];

export const ASSESSMENT_STEP_VALUES = [
  "GENDER",
  "GOAL",
  "ACTIVITY",
  "HEIGHT",
  "WEIGHT",
  "AGE",
  "TARGET_WEIGHT",
] as const;
export type AssessmentStep = (typeof ASSESSMENT_STEP_VALUES)[number];

export const ASSESSMENT_STATUS_VALUES = ["IN_PROGRESS", "COMPLETED"] as const;
export const IN_PROGRESS_ASSESSMENT_STATUS = ASSESSMENT_STATUS_VALUES[0];
export const COMPLETED_ASSESSMENT_STATUS = ASSESSMENT_STATUS_VALUES[1];
export type AssessmentStatus = (typeof ASSESSMENT_STATUS_VALUES)[number];

export interface AssessmentAnswers {
  gender?: Gender | null;
  goal?: Goal | null;
  activityLevel?: ActivityLevel | null;
  heightCm?: number | null;
  weightKg?: number | null;
  age?: number | null;
  targetWeightKg?: number | null;
}

export type CompleteAssessmentAnswers = {
  [Key in keyof Required<AssessmentAnswers>]: NonNullable<
    Required<AssessmentAnswers>[Key]
  >;
};

export interface AssessmentAggregateState {
  id: string;
  status: AssessmentStatus;
  revision: number;
  answers: Required<AssessmentAnswers>;
}

type StepDefinition = {
  isValid: (answers: AssessmentAnswers) => boolean;
  isPresent: (answers: AssessmentAnswers) => boolean;
};

function isFiniteWithin(
  value: number | null | undefined,
  limits: { readonly min: number; readonly max: number },
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= limits.min &&
    value <= limits.max
  );
}

function isAgeValid(age: number | null | undefined): age is number {
  return (
    isFiniteWithin(age, ASSESSMENT_INPUT_LIMITS.age) && Number.isInteger(age)
  );
}

export function isTargetWeightCompatible(answers: AssessmentAnswers): boolean {
  const { goal, weightKg, targetWeightKg } = answers;

  if (
    goal == null ||
    !isFiniteWithin(weightKg, ASSESSMENT_INPUT_LIMITS.weightKg) ||
    !isFiniteWithin(targetWeightKg, ASSESSMENT_INPUT_LIMITS.targetWeightKg)
  ) {
    return false;
  }

  switch (goal) {
    case "LOSE_WEIGHT":
      return targetWeightKg < weightKg;
    case "GAIN_WEIGHT":
      return targetWeightKg > weightKg;
    case "MAINTAIN":
      return targetWeightKg === weightKg;
  }
}

const stepDefinitionByStep = {
  GENDER: {
    isValid: (answers) => answers.gender != null,
    isPresent: (answers) => answers.gender != null,
  },
  GOAL: {
    isValid: (answers) => answers.goal != null,
    isPresent: (answers) => answers.goal != null,
  },
  ACTIVITY: {
    isValid: (answers) => answers.activityLevel != null,
    isPresent: (answers) => answers.activityLevel != null,
  },
  HEIGHT: {
    isValid: (answers) =>
      isFiniteWithin(answers.heightCm, ASSESSMENT_INPUT_LIMITS.heightCm),
    isPresent: (answers) => answers.heightCm != null,
  },
  WEIGHT: {
    isValid: (answers) =>
      isFiniteWithin(answers.weightKg, ASSESSMENT_INPUT_LIMITS.weightKg),
    isPresent: (answers) => answers.weightKg != null,
  },
  AGE: {
    isValid: (answers) => isAgeValid(answers.age),
    isPresent: (answers) => answers.age != null,
  },
  TARGET_WEIGHT: {
    isValid: isTargetWeightCompatible,
    isPresent: (answers) => answers.targetWeightKg != null,
  },
} satisfies Record<AssessmentStep, StepDefinition>;

export function getInvalidAssessmentSteps(
  answers: AssessmentAnswers,
): AssessmentStep[] {
  return ASSESSMENT_STEP_VALUES.filter(
    (step) => !stepDefinitionByStep[step].isValid(answers),
  );
}

export function getNextRequiredStep(
  answers: AssessmentAnswers,
): AssessmentStep | null {
  return getInvalidAssessmentSteps(answers)[0] ?? null;
}

export type StepWritePolicyResult =
  | { allowed: true }
  | {
      allowed: false;
      nextRequiredStep: AssessmentStep | null;
    };

export function validateStepWrite(
  answers: AssessmentAnswers,
  step: AssessmentStep,
): StepWritePolicyResult {
  const nextRequiredStep = getNextRequiredStep(answers);

  if (step === nextRequiredStep) {
    return { allowed: true };
  }

  if (stepDefinitionByStep[step].isPresent(answers)) {
    return { allowed: true };
  }

  return { allowed: false, nextRequiredStep };
}
