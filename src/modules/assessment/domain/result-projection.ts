import type { BmiCategory } from "./calculation";

export interface AssessmentResultSnapshot {
  bmi: number;
  bmiCategory: BmiCategory;
  recommendedDailyCalories: number;
  estimatedGoalDate: Date;
}

export type ResultAccess = "FREE" | "ACTIVE";

export function projectFreeResult(snapshot: AssessmentResultSnapshot) {
  return {
    access: "FREE",
    bmi: {
      value: snapshot.bmi,
      category: snapshot.bmiCategory,
    },
    recommendedDailyCalories: { locked: true },
    estimatedGoalDate: { locked: true },
  } as const;
}

export function projectActiveResult(snapshot: AssessmentResultSnapshot) {
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
  } as const;
}

export function projectResult(
  snapshot: AssessmentResultSnapshot,
  access: ResultAccess,
) {
  return access === "ACTIVE"
    ? projectActiveResult(snapshot)
    : projectFreeResult(snapshot);
}
