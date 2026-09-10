import { describe, expect, it } from "vitest";

import { getNextRequiredStep } from "./assessment";

describe("getNextRequiredStep", () => {
  it("starts with gender when no answers exist", () => {
    expect(getNextRequiredStep({})).toBe("GENDER");
  });

  it("derives goal as the next step after gender is present", () => {
    expect(getNextRequiredStep({ gender: "MALE" })).toBe("GOAL");
  });
});
