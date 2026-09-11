import { describe, expect, it } from "vitest";

import { getNextRequiredStep } from "./assessment";

const completeAssessment = {
  gender: "MALE" as const,
  goal: "LOSE_WEIGHT" as const,
  activityLevel: "MODERATE" as const,
  heightCm: 175,
  weightKg: 80,
  age: 24,
  targetWeightKg: 72,
};

describe("getNextRequiredStep", () => {
  it("starts with gender when no answers exist", () => {
    expect(getNextRequiredStep({})).toBe("GENDER");
  });

  it("derives goal as the next step after gender is present", () => {
    expect(getNextRequiredStep({ gender: "MALE" })).toBe("GOAL");
  });

  it.each([
    ["HEIGHT", { heightCm: 80 }],
    ["WEIGHT", { weightKg: 400 }],
    ["AGE", { age: 17 }],
    ["AGE", { age: 24.5 }],
    ["TARGET_WEIGHT", { targetWeightKg: 500 }],
  ] as const)(
    "treats a persisted out-of-contract %s value as unresolved",
    (expectedStep, override) => {
      expect(
        getNextRequiredStep({ ...completeAssessment, ...override }),
      ).toBe(expectedStep);
    },
  );
});
