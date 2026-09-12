import { z } from "zod";

import { assertNever } from "@/lib/assert-never";

import {
  ASSESSMENT_STEP_VALUES,
  type AssessmentAnswers,
  type AssessmentStep,
} from "../domain/assessment";
import {
  activityLevelSchema,
  ageAnswerSchema,
  assessmentRevisionSchema,
  genderSchema,
  goalSchema,
  heightAnswerSchema,
  targetWeightAnswerSchema,
  weightAnswerSchema,
} from "./primitives";

export { ASSESSMENT_INPUT_LIMITS } from "../domain/input-limits";

const commandBaseShape = {
  expectedRevision: assessmentRevisionSchema,
} as const;

export const assessmentStepCommandSchema = z.discriminatedUnion("step", [
  z.object({ ...commandBaseShape, step: z.literal("GENDER"), value: genderSchema }).strict(),
  z.object({ ...commandBaseShape, step: z.literal("GOAL"), value: goalSchema }).strict(),
  z
    .object({
      ...commandBaseShape,
      step: z.literal("ACTIVITY"),
      value: activityLevelSchema,
    })
    .strict(),
  z
    .object({
      ...commandBaseShape,
      step: z.literal("HEIGHT"),
      value: heightAnswerSchema,
    })
    .strict(),
  z
    .object({
      ...commandBaseShape,
      step: z.literal("WEIGHT"),
      value: weightAnswerSchema,
    })
    .strict(),
  z
    .object({
      ...commandBaseShape,
      step: z.literal("AGE"),
      value: ageAnswerSchema,
    })
    .strict(),
  z
    .object({
      ...commandBaseShape,
      step: z.literal("TARGET_WEIGHT"),
      value: targetWeightAnswerSchema,
    })
    .strict(),
]);

export type AssessmentStepCommand = z.infer<typeof assessmentStepCommandSchema>;

export type AssessmentStepParseResult =
  | { success: true; data: AssessmentStepCommand }
  | { success: false; issues: ReadonlyArray<{ path: string; message: string }> };

export function assessmentAnswerPatchForCommand(
  command: AssessmentStepCommand,
): Partial<AssessmentAnswers> {
  switch (command.step) {
    case "GENDER":
      return { gender: command.value };
    case "GOAL":
      return { goal: command.value };
    case "ACTIVITY":
      return { activityLevel: command.value };
    case "HEIGHT":
      return { heightCm: command.value };
    case "WEIGHT":
      return { weightKg: command.value };
    case "AGE":
      return { age: command.value };
    case "TARGET_WEIGHT":
      return { targetWeightKg: command.value };
    default:
      return assertNever(command, "assessment step command");
  }
}

export const domainStepToRouteStep = {
  GENDER: "gender",
  GOAL: "goal",
  ACTIVITY: "activity",
  HEIGHT: "height",
  WEIGHT: "weight",
  AGE: "age",
  TARGET_WEIGHT: "target-weight",
} as const satisfies Record<AssessmentStep, string>;

export type RouteStepKey = (typeof domainStepToRouteStep)[AssessmentStep];
const ROUTE_STEP_KEYS: readonly RouteStepKey[] = Object.values(domainStepToRouteStep);

function isRouteStepKey(stepKey: string): stepKey is RouteStepKey {
  return ROUTE_STEP_KEYS.some((candidate) => candidate === stepKey);
}

function domainStepForRouteKey(stepKey: RouteStepKey): AssessmentStep {
  const step = ASSESSMENT_STEP_VALUES.find(
    (candidate) => domainStepToRouteStep[candidate] === stepKey,
  );

  if (!step) {
    throw new Error(`Missing domain step mapping for route key: ${stepKey}`);
  }

  return step;
}

function issuesFrom(error: z.ZodError): AssessmentStepParseResult {
  return {
    success: false,
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

const stepRequestBodySchema = z
  .object({
    value: z.unknown(),
    expectedRevision: assessmentRevisionSchema,
  })
  .strict();

export function parseAssessmentStepRequest(
  stepKey: string,
  input: unknown,
): AssessmentStepParseResult {
  if (!isRouteStepKey(stepKey)) {
    return {
      success: false,
      issues: [{ path: "stepKey", message: "Unsupported assessment step." }],
    };
  }

  const parsedBody = stepRequestBodySchema.safeParse(input);
  if (!parsedBody.success) {
    return issuesFrom(parsedBody.error);
  }

  const parsedCommand = assessmentStepCommandSchema.safeParse({
    step: domainStepForRouteKey(stepKey),
    ...parsedBody.data,
  });

  return parsedCommand.success
    ? { success: true, data: parsedCommand.data }
    : issuesFrom(parsedCommand.error);
}
