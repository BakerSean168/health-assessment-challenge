import { z } from "zod";

import {
  ACTIVITY_LEVEL_VALUES,
  GENDER_VALUES,
  GOAL_VALUES,
} from "../domain/assessment";
import { ASSESSMENT_INPUT_LIMITS } from "../domain/input-limits";

export const assessmentRevisionSchema = z.number().int().nonnegative();
export const genderSchema = z.enum(GENDER_VALUES);
export const goalSchema = z.enum(GOAL_VALUES);
export const activityLevelSchema = z.enum(ACTIVITY_LEVEL_VALUES);
export const ageAnswerSchema = z
  .number()
  .int()
  .min(ASSESSMENT_INPUT_LIMITS.age.min)
  .max(ASSESSMENT_INPUT_LIMITS.age.max);
export const heightAnswerSchema = z
  .number()
  .min(ASSESSMENT_INPUT_LIMITS.heightCm.min)
  .max(ASSESSMENT_INPUT_LIMITS.heightCm.max);
export const weightAnswerSchema = z
  .number()
  .min(ASSESSMENT_INPUT_LIMITS.weightKg.min)
  .max(ASSESSMENT_INPUT_LIMITS.weightKg.max);
export const targetWeightAnswerSchema = z
  .number()
  .min(ASSESSMENT_INPUT_LIMITS.targetWeightKg.min)
  .max(ASSESSMENT_INPUT_LIMITS.targetWeightKg.max);
