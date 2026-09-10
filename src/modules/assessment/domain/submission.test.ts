import { describe, expect, it } from "vitest";

import { validateAssessmentReadyForSubmission } from "./submission";

describe("validateAssessmentReadyForSubmission", () => {
  it("returns all unresolved/invalid semantic steps", () => {
    expect(
      validateAssessmentReadyForSubmission({ gender: "MALE" }),
    ).toEqual({
      ready: false,
      missingSteps: [
        "GOAL",
        "ACTIVITY",
        "HEIGHT",
        "WEIGHT",
        "AGE",
        "TARGET_WEIGHT",
      ],
    });
  });

  it("returns a typed complete answer set when the draft is valid", () => {
    const answers = {
      gender: "MALE" as const,
      goal: "LOSE_WEIGHT" as const,
      activityLevel: "MODERATE" as const,
      heightCm: 175,
      weightKg: 80,
      age: 24,
      targetWeightKg: 72,
    };

    expect(validateAssessmentReadyForSubmission(answers)).toEqual({
      ready: true,
      answers,
    });
  });
});
