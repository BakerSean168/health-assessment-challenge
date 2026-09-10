import { describe, expect, it } from "vitest";

import { projectFreeResult } from "./result-projection";

const snapshot = {
  bmi: 26.1,
  bmiCategory: "OVERWEIGHT" as const,
  recommendedDailyCalories: 2460,
  estimatedGoalDate: new Date("2026-12-31T00:00:00.000Z"),
};

describe("free result projection", () => {
  it("returns public BMI while representing premium sections as locked", () => {
    expect(projectFreeResult(snapshot)).toEqual({
      access: "FREE",
      bmi: {
        value: 26.1,
        category: "OVERWEIGHT",
      },
      recommendedDailyCalories: { locked: true },
      estimatedGoalDate: { locked: true },
    });
  });

  it("does not serialize premium values into the free projection", () => {
    const serialized = JSON.stringify(projectFreeResult(snapshot));

    expect(serialized).not.toContain("2460");
    expect(serialized).not.toContain("2026-12-31");
  });
});
