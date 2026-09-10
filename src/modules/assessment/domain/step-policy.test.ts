import { describe, expect, it } from "vitest";

import {
  getNextRequiredStep,
  validateStepWrite,
  type AssessmentAnswers,
} from "./assessment";

const completeLoseAssessment: Required<AssessmentAnswers> = {
  gender: "MALE",
  goal: "LOSE_WEIGHT",
  activityLevel: "MODERATE",
  heightCm: 175,
  weightKg: 80,
  age: 24,
  targetWeightKg: 72,
};

describe("assessment step policy", () => {
  it("rejects skipping an unresolved prerequisite", () => {
    expect(
      validateStepWrite(
        { ...completeLoseAssessment, goal: null, activityLevel: null, heightCm: null },
        "HEIGHT",
      ),
    ).toEqual({
      allowed: false,
      nextRequiredStep: "GOAL",
    });
  });

  it("allows the current unresolved step", () => {
    expect(
      validateStepWrite(
        { ...completeLoseAssessment, activityLevel: null },
        "ACTIVITY",
      ),
    ).toEqual({ allowed: true });
  });

  it("allows editing an already answered earlier step", () => {
    expect(validateStepWrite(completeLoseAssessment, "GENDER")).toEqual({
      allowed: true,
    });
  });
});

describe("cross-field target-weight validity", () => {
  it("requires a lower target for a lose-weight goal", () => {
    expect(
      getNextRequiredStep({
        ...completeLoseAssessment,
        targetWeightKg: 82,
      }),
    ).toBe("TARGET_WEIGHT");
  });

  it("requires a higher target for a gain-weight goal", () => {
    expect(
      getNextRequiredStep({
        ...completeLoseAssessment,
        goal: "GAIN_WEIGHT",
        targetWeightKg: 72,
      }),
    ).toBe("TARGET_WEIGHT");
  });

  it("requires the target to equal current weight for maintain", () => {
    expect(
      getNextRequiredStep({
        ...completeLoseAssessment,
        goal: "MAINTAIN",
        targetWeightKg: 79,
      }),
    ).toBe("TARGET_WEIGHT");

    expect(
      getNextRequiredStep({
        ...completeLoseAssessment,
        goal: "MAINTAIN",
        targetWeightKg: 80,
      }),
    ).toBeNull();
  });
});
