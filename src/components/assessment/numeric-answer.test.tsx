// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NumericAnswer } from "./numeric-answer";

describe("NumericAnswer", () => {
  it("keeps numeric input semantics while suppressing native stepper controls", () => {
    render(
      <NumericAnswer
        label="Height"
        value="171.9"
        onChange={vi.fn()}
        min={120}
        max={230}
        step={0.1}
        unit="cm"
      />,
    );

    const input = screen.getByRole("spinbutton", { name: "Height" });
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(input).toHaveClass("[appearance:textfield]");
    expect(input).toHaveClass("[&::-webkit-inner-spin-button]:appearance-none");
    expect(input).toHaveClass("[&::-webkit-outer-spin-button]:appearance-none");
  });
});
