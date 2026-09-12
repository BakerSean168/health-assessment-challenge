import {
  ACTIVE_SUBSCRIPTION_STATUS,
  FREE_SUBSCRIPTION_STATUS,
  type SubscriptionStatus,
} from "../../session/domain/session";
import type { AssessmentCalculationResult } from "./calculation";

export type AssessmentResultSnapshot = Pick<
  AssessmentCalculationResult,
  "bmi" | "bmiCategory" | "recommendedDailyCalories" | "estimatedGoalDate"
>;

export type ResultAccess = SubscriptionStatus;

export function projectFreeResult(snapshot: AssessmentResultSnapshot) {
  return {
    access: FREE_SUBSCRIPTION_STATUS,
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
    access: ACTIVE_SUBSCRIPTION_STATUS,
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
  return access === ACTIVE_SUBSCRIPTION_STATUS
    ? projectActiveResult(snapshot)
    : projectFreeResult(snapshot);
}
