import type { BmiCategory } from "./calculation";

export interface AssessmentResultSnapshot {
  bmi: number;
  bmiCategory: BmiCategory;
  recommendedDailyCalories: number;
  estimatedGoalDate: Date;
}

export interface FreeResultDto {
  access: "FREE";
  bmi: {
    value: number;
    category: BmiCategory;
  };
  recommendedDailyCalories: {
    locked: true;
  };
  estimatedGoalDate: {
    locked: true;
  };
}

export interface ActiveResultDto {
  access: "ACTIVE";
  bmi: {
    value: number;
    category: BmiCategory;
  };
  recommendedDailyCalories: {
    locked: false;
    value: number;
  };
  estimatedGoalDate: {
    locked: false;
    value: string;
  };
}

export type ResultDto = FreeResultDto | ActiveResultDto;
export type ResultAccess = "FREE" | "ACTIVE";

export function projectFreeResult(
  snapshot: AssessmentResultSnapshot,
): FreeResultDto {
  return {
    access: "FREE",
    bmi: {
      value: snapshot.bmi,
      category: snapshot.bmiCategory,
    },
    recommendedDailyCalories: { locked: true },
    estimatedGoalDate: { locked: true },
  };
}

export function projectActiveResult(
  snapshot: AssessmentResultSnapshot,
): ActiveResultDto {
  return {
    access: "ACTIVE",
    bmi: {
      value: snapshot.bmi,
      category: snapshot.bmiCategory,
    },
    recommendedDailyCalories: {
      locked: false,
      value: snapshot.recommendedDailyCalories,
    },
    estimatedGoalDate: {
      locked: false,
      value: snapshot.estimatedGoalDate.toISOString().slice(0, 10),
    },
  };
}

export function projectResult(
  snapshot: AssessmentResultSnapshot,
  access: ResultAccess,
): ResultDto {
  return access === "ACTIVE"
    ? projectActiveResult(snapshot)
    : projectFreeResult(snapshot);
}
