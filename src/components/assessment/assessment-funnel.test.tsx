// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AssessmentBrowserApi } from "@/modules/assessment/client/assessment-api";
import { AssessmentFunnel } from "./assessment-funnel";

const emptyAnswers = {
  gender: null,
  goal: null,
  activityLevel: null,
  heightCm: null,
  weightKg: null,
  age: null,
  targetWeightKg: null,
} as const;

function createApi(
  overrides: Partial<AssessmentBrowserApi> = {},
): AssessmentBrowserApi {
  return {
    bootstrapSession: vi.fn().mockResolvedValue(undefined),
    getAssessment: vi.fn().mockResolvedValue({
      status: "IN_PROGRESS",
      nextRequiredStep: "GENDER",
      revision: 0,
      answers: { ...emptyAnswers },
    }),
    saveStep: vi.fn().mockResolvedValue({
      saved: true,
      revision: 1,
      nextRequiredStep: "GOAL",
    }),
    submitAssessment: vi.fn().mockResolvedValue({
      status: "COMPLETED",
      resultReady: true,
    }),
    ...overrides,
  };
}

describe("AssessmentFunnel", () => {
  it("persists an answer before moving to the server-derived next step", async () => {
    const user = userEvent.setup();
    const api = createApi();

    render(<AssessmentFunnel api={api} onComplete={vi.fn()} />);

    expect(
      await screen.findByRole("heading", { name: "Which best describes you?" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Male" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(api.saveStep).toHaveBeenCalledWith("GENDER", "MALE", 0),
    );
    expect(
      await screen.findByRole("heading", { name: "What is your main goal?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 7")).toBeInTheDocument();
  });

  it("restores the server-derived resumable step and lets the user revisit a saved answer", async () => {
    const user = userEvent.setup();
    const api = createApi({
      getAssessment: vi.fn().mockResolvedValue({
        status: "IN_PROGRESS",
        nextRequiredStep: "GOAL",
        revision: 1,
        answers: { ...emptyAnswers, gender: "MALE" },
      }),
    });

    render(<AssessmentFunnel api={api} onComplete={vi.fn()} />);

    expect(
      await screen.findByRole("heading", { name: "What is your main goal?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go back" }));

    expect(
      screen.getByRole("heading", { name: "Which best describes you?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Male" })).toBeChecked();
  });

  it("keeps the current step visible and surfaces a server save error", async () => {
    const user = userEvent.setup();
    const api = createApi({
      saveStep: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("The assessment changed since this page loaded."), {
            code: "ASSESSMENT_VERSION_CONFLICT",
          }),
        ),
    });

    render(<AssessmentFunnel api={api} onComplete={vi.fn()} />);

    await user.click(await screen.findByRole("radio", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The assessment changed since this page loaded.",
    );
    expect(
      screen.getByRole("heading", { name: "Which best describes you?" }),
    ).toBeInTheDocument();
  });

  it("submits with the newly returned revision after the final saved answer", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const api = createApi({
      getAssessment: vi.fn().mockResolvedValue({
        status: "IN_PROGRESS",
        nextRequiredStep: "TARGET_WEIGHT",
        revision: 6,
        answers: {
          gender: "MALE",
          goal: "LOSE_WEIGHT",
          activityLevel: "MODERATE",
          heightCm: 175,
          weightKg: 80,
          age: 24,
          targetWeightKg: null,
        },
      }),
      saveStep: vi.fn().mockResolvedValue({
        saved: true,
        revision: 7,
        nextRequiredStep: null,
      }),
    });

    render(<AssessmentFunnel api={api} onComplete={onComplete} />);

    const input = await screen.findByRole("spinbutton", { name: "Target weight" });
    await user.clear(input);
    await user.type(input, "72");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(api.saveStep).toHaveBeenCalledWith("TARGET_WEIGHT", 72, 6),
    );
    await waitFor(() =>
      expect(api.submitAssessment).toHaveBeenCalledWith(7),
    );
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });
});
