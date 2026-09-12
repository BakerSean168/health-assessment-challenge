// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NumericAnswer } from "./numeric-answer";

describe("NumericAnswer", () => {
  it("uses direct numeric entry without native spinner chrome and shows the accepted range in the label row", () => {
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
    expect(input.className).toContain("appearance:textfield");
    expect(screen.getByText("120–230 cm", { exact: true })).toBeInTheDocument();
  });
});
