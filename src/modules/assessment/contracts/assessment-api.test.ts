import { describe, expect, it } from "vitest";

import {
  assessmentRecoveryDtoSchema,
  resultDtoSchema,
  sessionBootstrapDtoSchema,
} from "./assessment-api";

const emptyAnswers = {
  gender: null,
  goal: null,
  activityLevel: null,
  heightCm: null,
  weightKg: null,
  age: null,
  targetWeightKg: null,
};

describe("shared assessment API contracts", () => {
  it("accepts the bootstrap shape shared by server and browser", () => {
    expect(
      sessionBootstrapDtoSchema.safeParse({
        orderId: "11111111-1111-4111-8111-111111111111",
        subscriptionStatus: "FREE",
        assessment: {
          status: "IN_PROGRESS",
          nextRequiredStep: "GENDER",
          revision: 0,
          answers: emptyAnswers,
        },
      }).success,
    ).toBe(true);
  });

  it("rejects response drift instead of silently trusting a TypeScript assertion", () => {
    const drifted = assessmentRecoveryDtoSchema.safeParse({
      status: "IN_PROGRESS",
      nextRequiredStep: "GENDER",
      revision: 0,
      answers: emptyAnswers,
      currentStep: 1,
    });

    expect(drifted.success).toBe(false);
  });

  it("keeps FREE and ACTIVE result payloads as a discriminated union", () => {
    expect(
      resultDtoSchema.safeParse({
        access: "FREE",
        bmi: { value: 24.5, category: "NORMAL" },
        recommendedDailyCalories: { locked: true },
        estimatedGoalDate: { locked: true },
      }).success,
    ).toBe(true);

    expect(
      resultDtoSchema.safeParse({
        access: "FREE",
        bmi: { value: 24.5, category: "NORMAL" },
        recommendedDailyCalories: { locked: true, value: 2380 },
        estimatedGoalDate: { locked: true },
      }).success,
    ).toBe(false);
  });
});
