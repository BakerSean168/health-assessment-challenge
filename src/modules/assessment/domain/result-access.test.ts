import { describe, expect, it } from "vitest";

import { projectResult } from "./result-projection";

const snapshot = {
  bmi: 26.1,
  bmiCategory: "OVERWEIGHT" as const,
  recommendedDailyCalories: 2460,
  estimatedGoalDate: new Date("2026-12-31T00:00:00.000Z"),
};

describe("subscription-aware result projection", () => {
  it("returns the existing free projection for FREE access", () => {
    expect(projectResult(snapshot, "FREE")).toEqual({
      access: "FREE",
      bmi: { value: 26.1, category: "OVERWEIGHT" },
      recommendedDailyCalories: { locked: true },
      estimatedGoalDate: { locked: true },
    });
  });

  it("returns the full stored result for ACTIVE access", () => {
    expect(projectResult(snapshot, "ACTIVE")).toEqual({
      access: "ACTIVE",
      bmi: { value: 26.1, category: "OVERWEIGHT" },
      recommendedDailyCalories: { locked: false, value: 2460 },
      estimatedGoalDate: { locked: false, value: "2026-12-31" },
    });
  });
});
