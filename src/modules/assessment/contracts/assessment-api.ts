import { z } from "zod";

import {
  ACTIVITY_LEVEL_VALUES,
  ASSESSMENT_STATUS_VALUES,
  ASSESSMENT_STEP_VALUES,
  GENDER_VALUES,
  GOAL_VALUES,
} from "../domain/assessment";
import { BMI_CATEGORY_VALUES } from "../domain/calculation";
import { SUBSCRIPTION_STATUS_VALUES } from "../../session/domain/session";

const assessmentStepSchema = z.enum(ASSESSMENT_STEP_VALUES);
const assessmentStatusSchema = z.enum(ASSESSMENT_STATUS_VALUES);
const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUS_VALUES);
const bmiCategorySchema = z.enum(BMI_CATEGORY_VALUES);

export const assessmentAnswersDtoSchema = z
  .object({
    gender: z.enum(GENDER_VALUES).nullable(),
    goal: z.enum(GOAL_VALUES).nullable(),
    activityLevel: z.enum(ACTIVITY_LEVEL_VALUES).nullable(),
    heightCm: z.number().nullable(),
    weightKg: z.number().nullable(),
    age: z.number().nullable(),
    targetWeightKg: z.number().nullable(),
  })
  .strict();

export const assessmentRecoveryDtoSchema = z
  .object({
    status: assessmentStatusSchema,
    nextRequiredStep: assessmentStepSchema.nullable(),
    revision: z.number().int().nonnegative(),
    answers: assessmentAnswersDtoSchema,
  })
  .strict();

export const sessionBootstrapDtoSchema = z
  .object({
    orderId: z.uuid(),
    subscriptionStatus: subscriptionStatusSchema,
    assessment: assessmentRecoveryDtoSchema,
  })
  .strict();

export const saveAssessmentStepDtoSchema = z
  .object({
    saved: z.literal(true),
    revision: z.number().int().nonnegative(),
    nextRequiredStep: assessmentStepSchema.nullable(),
  })
  .strict();

export const submitAssessmentDtoSchema = z
  .object({
    status: z.literal("COMPLETED"),
    resultReady: z.literal(true),
  })
  .strict();

const bmiResultDtoSchema = z
  .object({
    value: z.number(),
    category: bmiCategorySchema,
  })
  .strict();

const freeResultDtoSchema = z
  .object({
    access: z.literal("FREE"),
    bmi: bmiResultDtoSchema,
    recommendedDailyCalories: z.object({ locked: z.literal(true) }).strict(),
    estimatedGoalDate: z.object({ locked: z.literal(true) }).strict(),
  })
  .strict();

const activeResultDtoSchema = z
  .object({
    access: z.literal("ACTIVE"),
    bmi: bmiResultDtoSchema,
    recommendedDailyCalories: z
      .object({ locked: z.literal(false), value: z.number().int() })
      .strict(),
    estimatedGoalDate: z
      .object({
        locked: z.literal(false),
        value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .strict(),
  })
  .strict();

export const resultDtoSchema = z.discriminatedUnion("access", [
  freeResultDtoSchema,
  activeResultDtoSchema,
]);

export type AssessmentAnswersDto = z.infer<typeof assessmentAnswersDtoSchema>;
export type AssessmentRecoveryDto = z.infer<typeof assessmentRecoveryDtoSchema>;
export type SessionBootstrapDto = z.infer<typeof sessionBootstrapDtoSchema>;
export type SaveAssessmentStepDto = z.infer<typeof saveAssessmentStepDtoSchema>;
export type SubmitAssessmentDto = z.infer<typeof submitAssessmentDtoSchema>;
export type ResultDto = z.infer<typeof resultDtoSchema>;
export type FreeResultDto = Extract<ResultDto, { access: "FREE" }>;
export type ActiveResultDto = Extract<ResultDto, { access: "ACTIVE" }>;
