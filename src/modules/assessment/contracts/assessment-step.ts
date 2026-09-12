import { z } from "zod";

import {
  ACTIVITY_LEVEL_VALUES,
  type ActivityLevel,
  type AssessmentStep,
  GENDER_VALUES,
  type Gender,
  GOAL_VALUES,
  type Goal,
} from "../domain/assessment";
import { ASSESSMENT_INPUT_LIMITS } from "../domain/input-limits";

export { ASSESSMENT_INPUT_LIMITS } from "../domain/input-limits";

const expectedRevisionSchema = z.number().int().nonnegative();
const genderSchema = z.enum(GENDER_VALUES);
const goalSchema = z.enum(GOAL_VALUES);
const activityLevelSchema = z.enum(ACTIVITY_LEVEL_VALUES);
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

export interface AssessmentStepValueMap {
  GENDER: Gender;
  GOAL: Goal;
  ACTIVITY: ActivityLevel;
  HEIGHT: number;
  WEIGHT: number;
  AGE: number;
  TARGET_WEIGHT: number;
}

export type AssessmentStepCommand = {
  [Step in AssessmentStep]: {
    step: Step;
    value: AssessmentStepValueMap[Step];
    expectedRevision: number;
  };
}[AssessmentStep];

export type AssessmentStepParseResult =
  | { success: true; data: AssessmentStepCommand }
  | { success: false; issues: ReadonlyArray<{ path: string; message: string }> };

export const routeStepToDomainStep = {
  gender: "GENDER",
  goal: "GOAL",
  activity: "ACTIVITY",
  height: "HEIGHT",
  weight: "WEIGHT",
  age: "AGE",
  "target-weight": "TARGET_WEIGHT",
} as const satisfies Record<string, AssessmentStep>;

export type RouteStepKey = keyof typeof routeStepToDomainStep;

export const domainStepToRouteStep = {
  GENDER: "gender",
  GOAL: "goal",
  ACTIVITY: "activity",
  HEIGHT: "height",
  WEIGHT: "weight",
  AGE: "age",
  TARGET_WEIGHT: "target-weight",
} as const satisfies Record<AssessmentStep, RouteStepKey>;

function issuesFrom(error: z.ZodError): AssessmentStepParseResult {
  return {
    success: false,
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

function parseValue<Step extends AssessmentStep>(
  step: Step,
  schema: z.ZodType<AssessmentStepValueMap[Step]>,
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
