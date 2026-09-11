import { expect, test } from "@playwright/test";

import { completeDefaultAssessment } from "./assessment-flow";

test("a new visitor can complete, resume, and reach the redacted free result", async ({
  page,
}) => {
  await completeDefaultAssessment(page, { reloadBeforeAge: true });

  await expect(page.getByText("24.5", { exact: true })).toBeVisible();
  await expect(page.getByText("Normal range", { exact: true })).toBeVisible();
  await expect(page.getByText("Locked", { exact: true })).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Unlock my full result" }),
  ).toBeVisible();

  // Refreshing the result must read the same persisted snapshot and remain FREE.
  await page.reload();
  await expect(page.getByText("24.5", { exact: true })).toBeVisible();
  await expect(page.getByText("Locked", { exact: true })).toHaveCount(2);
});
