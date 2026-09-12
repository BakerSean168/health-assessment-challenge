// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { AssessmentStartLink } from "./assessment-start-link";

it("prewarms the anonymous assessment and points the CTA at its opaque order id", async () => {
  const api = {
    prewarmSession: vi.fn().mockResolvedValue({
      orderId: "11111111-1111-4111-8111-111111111111",
      subscriptionStatus: "FREE",
      assessment: {
        status: "IN_PROGRESS",
        nextRequiredStep: "GENDER",
        revision: 0,
        answers: {
          gender: null,
          goal: null,
          activityLevel: null,
          heightCm: null,
          weightKg: null,
          age: null,
          targetWeightKg: null,
        },
      },
    }),
  };

  render(<AssessmentStartLink api={api as never} />);

  const link = screen.getByRole("link", { name: "Start my assessment" });
  expect(link).toHaveAttribute("href", "/assessment");

  await waitFor(() => expect(api.prewarmSession).toHaveBeenCalledOnce());
  await waitFor(() =>
    expect(link).toHaveAttribute(
      "href",
      "/assessment?order=11111111-1111-4111-8111-111111111111",
    ),
  );
});
