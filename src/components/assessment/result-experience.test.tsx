// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ResultBrowserApi } from "@/modules/assessment/client/result-api";
import { ResultExperience } from "./result-experience";

const freeResult = {
  access: "FREE" as const,
  bmi: { value: 26.1, category: "OVERWEIGHT" as const },
  recommendedDailyCalories: { locked: true as const },
  estimatedGoalDate: { locked: true as const },
};

const activeResult = {
  access: "ACTIVE" as const,
  bmi: { value: 26.1, category: "OVERWEIGHT" as const },
  recommendedDailyCalories: { locked: false as const, value: 2460 },
  estimatedGoalDate: { locked: false as const, value: "2026-12-31" },
};

function createApi(overrides: Partial<ResultBrowserApi> = {}): ResultBrowserApi {
  return {
    getResult: vi.fn().mockResolvedValue(freeResult),
    pay: vi.fn().mockResolvedValue({
      status: "SUCCEEDED",
      subscriptionStatus: "ACTIVE",
      replayed: false,
    }),
    ...overrides,
  };
}

describe("ResultExperience", () => {
  it("shows useful BMI feedback while premium values stay visibly locked", async () => {
    const api = createApi();

    render(<ResultExperience api={api} idempotencyKeyFactory={() => "demo_key"} />);

    expect(
      await screen.findByRole("heading", { name: "Your wellness profile" }),
    ).toBeInTheDocument();
    expect(screen.getByText("26.1")).toBeInTheDocument();
    expect(screen.getByText("Overweight")).toBeInTheDocument();
    expect(screen.getAllByText("Locked")).toHaveLength(2);
    expect(screen.queryByText("2460")).not.toBeInTheDocument();
    expect(screen.queryByText("2026-12-31")).not.toBeInTheDocument();
  });

  it("opens a shadcn/Base UI paywall and unlocks the same result endpoint after demo payment", async () => {
    const user = userEvent.setup();
    const getResult = vi
      .fn()
      .mockResolvedValueOnce(freeResult)
      .mockResolvedValueOnce(activeResult);
    const pay = vi.fn().mockResolvedValue({
      status: "SUCCEEDED",
      subscriptionStatus: "ACTIVE",
      replayed: false,
    });
    const api = createApi({ getResult, pay });

    render(
      <ResultExperience api={api} idempotencyKeyFactory={() => "demo_unlock_001"} />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Unlock my full result" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Unlock your full result" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Complete demo payment" }));

    await waitFor(() => expect(pay).toHaveBeenCalledWith("demo_unlock_001"));
    await waitFor(() => expect(getResult).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("2,460 kcal/day")).toBeInTheDocument();
    expect(screen.getByText("Dec 31, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Locked")).not.toBeInTheDocument();
  });

  it("reuses the same idempotency key when a failed payment is retried", async () => {
    const user = userEvent.setup();
    const pay = vi
      .fn()
      .mockRejectedValueOnce(new Error("Payment response was interrupted."))
      .mockResolvedValueOnce({
        status: "SUCCEEDED",
        subscriptionStatus: "ACTIVE",
        replayed: true,
      });
    const getResult = vi
      .fn()
      .mockResolvedValueOnce(freeResult)
      .mockResolvedValueOnce(activeResult);
    const api = createApi({ getResult, pay });

    render(
      <ResultExperience api={api} idempotencyKeyFactory={() => "stable_retry_key"} />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Unlock my full result" }),
    );
    await user.click(screen.getByRole("button", { name: "Complete demo payment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Payment response was interrupted.",
    );

    await user.click(screen.getByRole("button", { name: "Try demo payment again" }));

    await waitFor(() => expect(pay).toHaveBeenCalledTimes(2));
    expect(pay).toHaveBeenNthCalledWith(1, "stable_retry_key");
    expect(pay).toHaveBeenNthCalledWith(2, "stable_retry_key");
    expect(await screen.findByText("2,460 kcal/day")).toBeInTheDocument();
  });
});
