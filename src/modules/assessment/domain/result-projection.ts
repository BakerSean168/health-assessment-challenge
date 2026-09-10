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
