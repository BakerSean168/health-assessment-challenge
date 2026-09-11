import { describe, expect, it } from "vitest";

import { validateAssessmentReadyForSubmission } from "./submission";

const completeAssessment = {
  gender: "MALE" as const,
  goal: "LOSE_WEIGHT" as const,
  activityLevel: "MODERATE" as const,
  heightCm: 175,
  weightKg: 80,
  age: 24,
  targetWeightKg: 72,
};

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

  it("does not trust an out-of-contract value merely because it was persisted", () => {
    expect(
      validateAssessmentReadyForSubmission({
        ...completeAssessment,
        heightCm: 80,
      }),
    ).toEqual({
      ready: false,
      missingSteps: ["HEIGHT"],
    });
  });

  it("returns a typed complete answer set when the draft is valid", () => {
    expect(validateAssessmentReadyForSubmission(completeAssessment)).toEqual({
      ready: true,
      answers: completeAssessment,
    });
  });
});
