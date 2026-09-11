import { expect, test } from "@playwright/test";

import { completeDefaultAssessment } from "./assessment-flow";

test("a free visitor can complete demo payment and unlock the stored result", async ({
  page,
}) => {
  await completeDefaultAssessment(page);

  await expect(page.getByText("Locked", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Unlock my full result" }).click();

  const paywall = page.getByRole("dialog", { name: "Unlock your complete profile" });
  await expect(paywall).toBeVisible();
  await expect(paywall).toContainText("No payment details are required");
  await expect(paywall).not.toContainText("FREE to ACTIVE");

  await paywall.getByRole("button", { name: "Unlock my results" }).click();

  await expect(page.getByText("Your complete profile is ready", { exact: true })).toBeVisible();
  await expect(page.getByText("2,380 kcal/day", { exact: true })).toBeVisible();
  await expect(page.getByText("Locked", { exact: true })).toHaveCount(0);

  // ACTIVE access is persisted on the server-owned anonymous session.
  await page.reload();
  await expect(page.getByText("2,380 kcal/day", { exact: true })).toBeVisible();
  await expect(page.getByText("Your complete profile is ready", { exact: true })).toBeVisible();
});
