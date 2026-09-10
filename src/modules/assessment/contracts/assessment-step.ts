import { z } from "zod";

import type {
  ActivityLevel,
  AssessmentStep,
  Gender,
  Goal,
} from "../domain/assessment";

export const ASSESSMENT_INPUT_LIMITS = {
  age: { min: 18, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 25, max: 300 },
  targetWeightKg: { min: 25, max: 300 },
} as const;

const expectedRevisionSchema = z.number().int().nonnegative();
const genderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);
const goalSchema = z.enum(["LOSE_WEIGHT", "MAINTAIN", "GAIN_WEIGHT"]);
const activityLevelSchema = z.enum([
  "SEDENTARY",
  "LIGHT",
  "MODERATE",
  "ACTIVE",
  "VERY_ACTIVE",
]);
const ageSchema = z
  .number()
  .int()
  .min(ASSESSMENT_INPUT_LIMITS.age.min)
  .max(ASSESSMENT_INPUT_LIMITS.age.max);
const heightSchema = z
  .number()
  .min(ASSESSMENT_INPUT_LIMITS.heightCm.min)
  .max(ASSESSMENT_INPUT_LIMITS.heightCm.max);
const weightSchema = z
  .number()
  .min(ASSESSMENT_INPUT_LIMITS.weightKg.min)
  .max(ASSESSMENT_INPUT_LIMITS.weightKg.max);
const targetWeightSchema = z
  .number()
  .min(ASSESSMENT_INPUT_LIMITS.targetWeightKg.min)
  .max(ASSESSMENT_INPUT_LIMITS.targetWeightKg.max);

export type AssessmentStepCommand =
  | { step: "GENDER"; value: Gender; expectedRevision: number }
  | { step: "GOAL"; value: Goal; expectedRevision: number }
  | { step: "ACTIVITY"; value: ActivityLevel; expectedRevision: number }
  | { step: "HEIGHT"; value: number; expectedRevision: number }
  | { step: "WEIGHT"; value: number; expectedRevision: number }
  | { step: "AGE"; value: number; expectedRevision: number }
  | { step: "TARGET_WEIGHT"; value: number; expectedRevision: number };

export type AssessmentStepParseResult =
  | { success: true; data: AssessmentStepCommand }
  | { success: false; issues: ReadonlyArray<{ path: string; message: string }> };

const routeStepToDomainStep = {
  gender: "GENDER",
  goal: "GOAL",
  activity: "ACTIVITY",
  height: "HEIGHT",
  weight: "WEIGHT",
  age: "AGE",
  "target-weight": "TARGET_WEIGHT",
} as const satisfies Record<string, AssessmentStep>;

type RouteStepKey = keyof typeof routeStepToDomainStep;

function issuesFrom(error: z.ZodError): AssessmentStepParseResult {
  return {
    success: false,
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

function parseValue<T>(
  step: AssessmentStep,
  schema: z.ZodType<T>,
  input: unknown,
): AssessmentStepParseResult {
  const parsed = z
    .object({ value: schema, expectedRevision: expectedRevisionSchema })
    .strict()
    .safeParse(input);

  if (!parsed.success) {
    return issuesFrom(parsed.error);
  }

  return {
    success: true,
    data: {
      step,
      value: parsed.data.value,
      expectedRevision: parsed.data.expectedRevision,
    } as AssessmentStepCommand,
  };
}

export function parseAssessmentStepRequest(
  stepKey: string,
  input: unknown,
): AssessmentStepParseResult {
  if (!(stepKey in routeStepToDomainStep)) {
    return {
      success: false,
      issues: [{ path: "stepKey", message: "Unsupported assessment step." }],
    };
  }

  switch (stepKey as RouteStepKey) {
    case "gender":
      return parseValue("GENDER", genderSchema, input);
    case "goal":
      return parseValue("GOAL", goalSchema, input);
    case "activity":
      return parseValue("ACTIVITY", activityLevelSchema, input);
    case "height":
      return parseValue("HEIGHT", heightSchema, input);
    case "weight":
      return parseValue("WEIGHT", weightSchema, input);
    case "age":
      return parseValue("AGE", ageSchema, input);
    case "target-weight":
      return parseValue("TARGET_WEIGHT", targetWeightSchema, input);
  }
}
