// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssessmentLanding } from "./assessment-landing";

describe("AssessmentLanding", () => {
  it("presents a real user-facing wellness entry instead of engineering proof copy", () => {
    render(<AssessmentLanding />);

    expect(
      screen.getByRole("heading", { name: "Build your wellness snapshot" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Takes about 2 minutes", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Personalized to your goal", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("What you'll get", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText(/progressive persistence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/versioned result snapshot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/access boundary/i)).not.toBeInTheDocument();

    const start = screen.getByRole("link", { name: "Start my assessment" });
    expect(start).toHaveAttribute("href", "/assessment");
  });
});
