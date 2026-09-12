// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BmiPreview } from "./bmi-preview";

describe("BmiPreview", () => {
  it("uses a positive visual state for BMI in the normal range", () => {
    render(<BmiPreview bmi={24.5} category="NORMAL" />);

    const preview = screen.getByRole("status");
    expect(preview).toHaveTextContent("24.5");
    expect(preview).toHaveTextContent("Within the standard range");
    expect(preview).toHaveAttribute("data-bmi-category", "NORMAL");
    expect(preview.className).toContain("emerald");
  });

  it("uses a warning visual state for BMI well above the standard range", () => {
    render(<BmiPreview bmi={32.7} category="OBESE" />);

    const preview = screen.getByRole("status");
    expect(preview).toHaveTextContent("32.7");
    expect(preview).toHaveTextContent("Well above the standard range");
    expect(preview).toHaveTextContent(/healthcare professional/i);
    expect(preview).toHaveAttribute("data-bmi-category", "OBESE");
    expect(preview.className).toContain("destructive");
  });
});
