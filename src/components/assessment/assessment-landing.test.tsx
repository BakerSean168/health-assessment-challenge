// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssessmentLanding } from "./assessment-landing";

describe("AssessmentLanding", () => {
  it("offers one clear entry into the persisted assessment and sets expectations", () => {
    render(<AssessmentLanding />);

    expect(
      screen.getByRole("heading", { name: "Build your wellness snapshot" }),
    ).toBeInTheDocument();
    expect(screen.getByText("7 short questions", { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/saved after every step/i)).toBeInTheDocument();

    const start = screen.getByRole("link", { name: "Start my assessment" });
    expect(start).toHaveAttribute("href", "/assessment");
  });
});
