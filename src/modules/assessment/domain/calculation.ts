import type {
  ActivityLevel,
  CompleteAssessmentAnswers,
  Gender,
  Goal,
} from "./assessment";

export const BMI_CATEGORY_VALUES = [
  "UNDERWEIGHT",
  "NORMAL",
  "OVERWEIGHT",
  "OBESE",
] as const;
export type BmiCategory = (typeof BMI_CATEGORY_VALUES)[number];

export type BmiInput = Pick<
  CompleteAssessmentAnswers,
  "weightKg" | "heightCm"
>;

export interface BmiResult {
  bmi: number;
  category: BmiCategory;
}

function roundTo(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function classifyRawBmi(rawBmi: number): BmiCategory {
  if (rawBmi < 18.5) return "UNDERWEIGHT";
  if (rawBmi < 25) return "NORMAL";
  if (rawBmi < 30) return "OVERWEIGHT";
  return "OBESE";
}

export function calculateBmi(input: BmiInput): BmiResult {
  const heightMeters = input.heightCm / 100;
  const rawBmi = input.weightKg / heightMeters ** 2;

  return {
    bmi: roundTo(rawBmi, 1),
    category: classifyRawBmi(rawBmi),
  };
}

const genderConstant: Record<Gender, number> = {
  MALE: 5,
  FEMALE: -161,
  OTHER: -78,
};

const activityMultiplier: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

const goalAdjustment: Record<Goal, number> = {
  LOSE_WEIGHT: -300,
  MAINTAIN: 0,
  GAIN_WEIGHT: 300,
};

const MINIMUM_DEMO_CALORIES = 1000;

export type RecommendedCaloriesInput = Pick<
  CompleteAssessmentAnswers,
  "gender" | "goal" | "activityLevel" | "heightCm" | "weightKg" | "age"
>;

export function calculateRecommendedDailyCalories(
  input: RecommendedCaloriesInput,
): number {
  const restingEstimate =
    10 * input.weightKg +
    6.25 * input.heightCm -
    5 * input.age +
    genderConstant[input.gender];

  const maintenanceEstimate =
    restingEstimate * activityMultiplier[input.activityLevel];
  const adjusted = maintenanceEstimate + goalAdjustment[input.goal];
  const bounded = Math.max(MINIMUM_DEMO_CALORIES, adjusted);

  return Math.round(bounded / 10) * 10;
}

export type TargetDateInput = Pick<
  CompleteAssessmentAnswers,
  "goal" | "weightKg" | "targetWeightKg"
>;

const PROJECTED_CHANGE_KG_PER_WEEK = 0.5;
const DAYS_PER_WEEK = 7;

function utcCalendarDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function estimateTargetDate(
  input: TargetDateInput,
  referenceDate: Date,
): Date {
  const normalizedReferenceDate = utcCalendarDate(referenceDate);

  if (input.goal === "MAINTAIN") {
    return normalizedReferenceDate;
  }

  const deltaKg = Math.abs(input.weightKg - input.targetWeightKg);
  const projectedWeeks = Math.ceil(deltaKg / PROJECTED_CHANGE_KG_PER_WEEK);
  const targetDate = new Date(normalizedReferenceDate);
  targetDate.setUTCDate(
    targetDate.getUTCDate() + projectedWeeks * DAYS_PER_WEEK,
  );

  return targetDate;
}

export const CALCULATION_VERSION = "demo-v1" as const;

export type AssessmentCalculationInput = CompleteAssessmentAnswers;

export interface AssessmentCalculationResult {
  bmi: number;
  bmiCategory: BmiCategory;
  recommendedDailyCalories: number;
  estimatedGoalDate: Date;
  calculationVersion: typeof CALCULATION_VERSION;
}

export function calculateAssessmentResult(
  input: AssessmentCalculationInput,
  referenceDate: Date,
): AssessmentCalculationResult {
  const bmi = calculateBmi(input);

  return {
    bmi: bmi.bmi,
    bmiCategory: bmi.category,
    recommendedDailyCalories: calculateRecommendedDailyCalories(input),
    estimatedGoalDate: estimateTargetDate(input, referenceDate),
    calculationVersion: CALCULATION_VERSION,
  };
}
