// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssessmentShell } from "./assessment-shell";

describe("AssessmentShell", () => {
  it("exposes consistent assessment context and accessible progress", () => {
    render(
      <AssessmentShell
        stepNumber={2}
        totalSteps={7}
        title="What is your main goal?"
        description="Choose the option that best matches what you want to work toward."
      >
        <div>Question control</div>
      </AssessmentShell>,
    );

    expect(
      screen.getByRole("heading", { name: "What is your main goal?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 7")).toBeInTheDocument();
    expect(screen.getByText("Question control")).toBeInTheDocument();

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "29");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
  });

  it("uses an accessible back action only when the caller provides one", () => {
    const onBack = vi.fn();
    const { rerender } = render(
      <AssessmentShell
        stepNumber={3}
        totalSteps={7}
        title="How active are you?"
        onBack={onBack}
      >
        <div>Options</div>
      </AssessmentShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(onBack).toHaveBeenCalledOnce();

    rerender(
      <AssessmentShell stepNumber={1} totalSteps={7} title="About you">
        <div>Options</div>
      </AssessmentShell>,
    );

    expect(
      screen.queryByRole("button", { name: "Go back" }),
    ).not.toBeInTheDocument();
  });
});
