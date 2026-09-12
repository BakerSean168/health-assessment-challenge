import { describe, expect, it } from "vitest";

import {
  domainStepToRouteStep,
  parseAssessmentStepRequest,
} from "./assessment-step";

function expectAccepted(stepKey: string, value: unknown) {
  const parsed = parseAssessmentStepRequest(stepKey, {
    value,
    expectedRevision: 3,
  });
  expect(parsed.success).toBe(true);
}

function expectRejected(stepKey: string, value: unknown) {
  const parsed = parseAssessmentStepRequest(stepKey, {
    value,
    expectedRevision: 3,
  });
  expect(parsed.success).toBe(false);
}

describe("assessment step runtime contracts", () => {
  it("keeps one unique route key for every domain step", () => {
    const routeKeys = Object.values(domainStepToRouteStep);
    expect(new Set(routeKeys).size).toBe(routeKeys.length);
  });

  it("accepts the frozen categorical values", () => {
    for (const gender of ["MALE", "FEMALE", "OTHER"]) {
      expectAccepted("gender", gender);
    }
    for (const goal of ["LOSE_WEIGHT", "MAINTAIN", "GAIN_WEIGHT"]) {
      expectAccepted("goal", goal);
    }
    for (const activity of [
      "SEDENTARY",
      "LIGHT",
      "MODERATE",
      "ACTIVE",
      "VERY_ACTIVE",
    ]) {
      expectAccepted("activity", activity);
    }
  });

  it("accepts inclusive numeric boundaries", () => {
    for (const age of [18, 100]) expectAccepted("age", age);
    for (const height of [120, 230]) expectAccepted("height", height);
    for (const weight of [25, 300]) expectAccepted("weight", weight);
    for (const target of [25, 300]) expectAccepted("target-weight", target);
  });

  it("rejects values outside numeric boundaries and non-integer age", () => {
    for (const age of [17, 18.5, 101]) expectRejected("age", age);
    for (const height of [119.9, 230.1]) expectRejected("height", height);
    for (const weight of [24.9, 300.1]) expectRejected("weight", weight);
    for (const target of [24.9, 300.1]) {
      expectRejected("target-weight", target);
    }
  });

  it("rejects unsupported steps, invalid categories, and extra input keys", () => {
    expectRejected("goal", "CUT_FAST");
    expectRejected("activity", "SOMETIMES");
    expectRejected("unknown", "anything");

    const extra = parseAssessmentStepRequest("age", {
      value: 25,
      expectedRevision: 0,
      sessionId: "client-controlled",
    });
    expect(extra.success).toBe(false);
  });
});
