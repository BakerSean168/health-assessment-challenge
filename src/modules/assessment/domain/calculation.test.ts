import { describe, expect, it } from "vitest";

import {
  calculateBmi,
  calculateRecommendedDailyCalories,
  estimateTargetDate,
} from "./calculation";

describe("BMI demo-v1", () => {
  it("calculates and rounds BMI to one decimal", () => {
    expect(calculateBmi({ weightKg: 70, heightCm: 175 })).toEqual({
      bmi: 22.9,
      category: "NORMAL",
    });
  });

  it.each([
    [18.5, "NORMAL"],
    [25, "OVERWEIGHT"],
    [30, "OBESE"],
  ] as const)("classifies the exact %s threshold", (rawBmi, category) => {
    const result = calculateBmi({
      heightCm: 200,
      weightKg: rawBmi * 4,
    });

    expect(result.category).toBe(category);
  });

  it("classifies using raw BMI instead of the rounded display value", () => {
    const result = calculateBmi({ heightCm: 200, weightKg: 99.84 });

    expect(result.bmi).toBe(25);
    expect(result.category).toBe("NORMAL");
  });
});

describe("recommended daily calories demo-v1", () => {
  const base = {
    heightCm: 180,
    weightKg: 80,
    age: 30,
    goal: "MAINTAIN" as const,
    activityLevel: "MODERATE" as const,
  };

  it.each([
    ["MALE", 2760],
    ["FEMALE", 2500],
    ["OTHER", 2630],
  ] as const)("uses the frozen %s resting-energy branch", (gender, expected) => {
    expect(
      calculateRecommendedDailyCalories({ ...base, gender }),
    ).toBe(expected);
  });

  it.each([
    ["SEDENTARY", 2140],
    ["LIGHT", 2450],
    ["MODERATE", 2760],
    ["ACTIVE", 3070],
    ["VERY_ACTIVE", 3380],
  ] as const)("uses the frozen %s activity multiplier", (activityLevel, expected) => {
    expect(
      calculateRecommendedDailyCalories({
        ...base,
        gender: "MALE",
        activityLevel,
      }),
    ).toBe(expected);
  });

  it.each([
    ["LOSE_WEIGHT", 2460],
    ["MAINTAIN", 2760],
    ["GAIN_WEIGHT", 3060],
  ] as const)("applies the %s goal adjustment", (goal, expected) => {
    expect(
      calculateRecommendedDailyCalories({
        ...base,
        gender: "MALE",
        goal,
      }),
    ).toBe(expected);
  });

  it("applies the defensive 1000 kcal lower guard", () => {
    expect(
      calculateRecommendedDailyCalories({
        gender: "FEMALE",
        goal: "LOSE_WEIGHT",
        activityLevel: "SEDENTARY",
        heightCm: 120,
        weightKg: 25,
        age: 100,
      }),
    ).toBe(1000);
  });
});

describe("target-date projection demo-v1", () => {
  const referenceDate = new Date("2026-09-10T00:00:00Z");

  it.each([
    ["LOSE_WEIGHT", 80, 72, "2026-12-31"],
    ["GAIN_WEIGHT", 72, 80, "2026-12-31"],
    ["MAINTAIN", 80, 80, "2026-09-10"],
  ] as const)(
    "projects %s from %s kg to %s kg",
    (goal, weightKg, targetWeightKg, expectedDate) => {
      const result = estimateTargetDate(
        { goal, weightKg, targetWeightKg },
        referenceDate,
      );

      expect(result.toISOString().slice(0, 10)).toBe(expectedDate);
    },
  );

  it("rounds a partial projected week upward", () => {
    const result = estimateTargetDate(
      { goal: "LOSE_WEIGHT", weightKg: 80, targetWeightKg: 79.9 },
      referenceDate,
    );

    expect(result.toISOString().slice(0, 10)).toBe("2026-09-17");
  });

  it("normalizes the injected reference time to a UTC calendar date", () => {
    const result = estimateTargetDate(
      { goal: "MAINTAIN", weightKg: 80, targetWeightKg: 80 },
      new Date("2026-09-10T23:59:59Z"),
    );

    expect(result.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });
});
