import { z } from "zod";

import {
  ASSESSMENT_STATUS_VALUES,
  COMPLETED_ASSESSMENT_STATUS,
  ASSESSMENT_STEP_VALUES,
  type AssessmentAnswers,
} from "../domain/assessment";
import { BMI_CATEGORY_VALUES } from "../domain/calculation";
import {
  ACTIVE_SUBSCRIPTION_STATUS,
  FREE_SUBSCRIPTION_STATUS,
  SUBSCRIPTION_STATUS_VALUES,
} from "../../session/domain/session";
import {
  activityLevelSchema,
  assessmentRevisionSchema,
  genderSchema,
  goalSchema,
} from "./primitives";

const assessmentStepSchema = z.enum(ASSESSMENT_STEP_VALUES);
const assessmentStatusSchema = z.enum(ASSESSMENT_STATUS_VALUES);
const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUS_VALUES);
const bmiCategorySchema = z.enum(BMI_CATEGORY_VALUES);

const assessmentAnswersDtoShape = {
  gender: genderSchema.nullable(),
  goal: goalSchema.nullable(),
  activityLevel: activityLevelSchema.nullable(),
  heightCm: z.number().nullable(),
  weightKg: z.number().nullable(),
  age: z.number().nullable(),
  targetWeightKg: z.number().nullable(),
} satisfies Record<keyof Required<AssessmentAnswers>, z.ZodType>;

export const assessmentAnswersDtoSchema = z
  .object(assessmentAnswersDtoShape)
  .strict();

export const assessmentRecoveryDtoSchema = z
  .object({
    status: assessmentStatusSchema,
    nextRequiredStep: assessmentStepSchema.nullable(),
    revision: assessmentRevisionSchema,
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
    revision: assessmentRevisionSchema,
    nextRequiredStep: assessmentStepSchema.nullable(),
  })
  .strict();

export const submitAssessmentDtoSchema = z
  .object({
    status: z.literal(COMPLETED_ASSESSMENT_STATUS),
    resultReady: z.literal(true),
  })
  .strict();

const bmiResultDtoSchema = z
  .object({
    value: z.number().positive(),
    category: bmiCategorySchema,
  })
  .strict();

const freeResultDtoSchema = z
  .object({
    access: z.literal(FREE_SUBSCRIPTION_STATUS),
    bmi: bmiResultDtoSchema,
    recommendedDailyCalories: z.object({ locked: z.literal(true) }).strict(),
    estimatedGoalDate: z.object({ locked: z.literal(true) }).strict(),
  })
  .strict();

const activeResultDtoSchema = z
  .object({
    access: z.literal(ACTIVE_SUBSCRIPTION_STATUS),
    bmi: bmiResultDtoSchema,
    recommendedDailyCalories: z
      .object({ locked: z.literal(false), value: z.number().int() })
      .strict(),
    estimatedGoalDate: z
      .object({
        locked: z.literal(false),
        value: z.iso.date(),
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
export type FreeResultDto = Extract<
  ResultDto,
  { access: typeof FREE_SUBSCRIPTION_STATUS }
>;
export type ActiveResultDto = Extract<
  ResultDto,
  { access: typeof ACTIVE_SUBSCRIPTION_STATUS }
>;
