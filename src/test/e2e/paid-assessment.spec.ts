import { expect, test } from "@playwright/test";

import { completeDefaultAssessment } from "./assessment-flow";

test("a free visitor can complete demo payment and unlock the stored result", async ({
  page,
}) => {
  await completeDefaultAssessment(page);

  await expect(page.getByText("Locked", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Unlock my full result" }).click();

  const paywall = page.getByRole("dialog", { name: "Unlock your full result" });
  await expect(paywall).toBeVisible();
  await expect(paywall).toContainText("simulated payment only");

  await paywall.getByRole("button", { name: "Complete demo payment" }).click();

  await expect(page.getByText("Full result unlocked", { exact: true })).toBeVisible();
  await expect(page.getByText("2,380 kcal/day", { exact: true })).toBeVisible();
  await expect(page.getByText("Locked", { exact: true })).toHaveCount(0);

  // ACTIVE access is persisted on the server-owned anonymous session.
  await page.reload();
  await expect(page.getByText("2,380 kcal/day", { exact: true })).toBeVisible();
  await expect(page.getByText("Full result unlocked", { exact: true })).toBeVisible();
});
