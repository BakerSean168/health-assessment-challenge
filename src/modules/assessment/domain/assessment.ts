import { ASSESSMENT_INPUT_LIMITS } from "./input-limits";

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

type StepDefinition = {
  step: AssessmentStep;
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

const requiredSteps: ReadonlyArray<StepDefinition> = [
  {
    step: "GENDER",
    isValid: (answers) => answers.gender != null,
    isPresent: (answers) => answers.gender != null,
  },
  {
    step: "GOAL",
    isValid: (answers) => answers.goal != null,
    isPresent: (answers) => answers.goal != null,
  },
  {
    step: "ACTIVITY",
    isValid: (answers) => answers.activityLevel != null,
    isPresent: (answers) => answers.activityLevel != null,
  },
  {
    step: "HEIGHT",
    isValid: (answers) =>
      isFiniteWithin(answers.heightCm, ASSESSMENT_INPUT_LIMITS.heightCm),
    isPresent: (answers) => answers.heightCm != null,
  },
  {
    step: "WEIGHT",
    isValid: (answers) =>
      isFiniteWithin(answers.weightKg, ASSESSMENT_INPUT_LIMITS.weightKg),
    isPresent: (answers) => answers.weightKg != null,
  },
  {
    step: "AGE",
    isValid: (answers) => isAgeValid(answers.age),
    isPresent: (answers) => answers.age != null,
  },
  {
    step: "TARGET_WEIGHT",
    isValid: isTargetWeightCompatible,
    isPresent: (answers) => answers.targetWeightKg != null,
  },
];

export function getInvalidAssessmentSteps(
  answers: AssessmentAnswers,
): AssessmentStep[] {
  return requiredSteps
    .filter(({ isValid }) => !isValid(answers))
    .map(({ step }) => step);
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

  const definition = requiredSteps.find((candidate) => candidate.step === step);
  if (definition?.isPresent(answers)) {
    return { allowed: true };
  }

  return { allowed: false, nextRequiredStep };
}
