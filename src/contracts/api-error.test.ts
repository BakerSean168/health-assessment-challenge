import { describe, expect, it } from "vitest";

import { API_ERROR_STATUS_BY_CODE, apiErrorEnvelopeSchema } from "./api-error";

describe("shared API error contract", () => {
  it("accepts the documented incomplete-assessment details", () => {
    expect(
      apiErrorEnvelopeSchema.safeParse({
        error: {
          code: "ASSESSMENT_INCOMPLETE",
          message: "Complete all required assessment steps before submitting.",
          details: { missingSteps: ["AGE", "TARGET_WEIGHT"] },
        },
      }).success,
    ).toBe(true);
  });

  it("rejects stale error-detail field names", () => {
    expect(
      apiErrorEnvelopeSchema.safeParse({
        error: {
          code: "ASSESSMENT_INCOMPLETE",
          message: "Complete all required assessment steps before submitting.",
          details: { requiredSteps: ["AGE", "TARGET_WEIGHT"] },
        },
      }).success,
    ).toBe(false);
  });

  it("maps unsupported JSON media types to 415", () => {
    expect(API_ERROR_STATUS_BY_CODE.UNSUPPORTED_MEDIA_TYPE).toBe(415);
    expect(
      apiErrorEnvelopeSchema.safeParse({
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "This endpoint requires an application/json request body.",
          details: {},
        },
      }).success,
    ).toBe(true);
  });

  it("rejects unknown machine error codes", () => {
    expect(
      apiErrorEnvelopeSchema.safeParse({
        error: {
          code: "ASSESSMENT_CHANGED_SOMEHOW",
          message: "Unknown error.",
          details: {},
        },
      }).success,
    ).toBe(false);
  });
});
