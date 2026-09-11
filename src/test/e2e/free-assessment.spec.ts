import { expect, test } from "@playwright/test";

test("a new visitor can complete, resume, and reach the redacted free result", async ({
  page,
}) => {
  await page.goto("/assessment");

  await expect(
    page.getByRole("heading", { name: "Which best describes you?" }),
  ).toBeVisible();
  await page.getByText("Male", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "What is your main goal?" }),
  ).toBeVisible();
  await page.getByText("Lose weight", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText("Moderately active", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("spinbutton", { name: "Height" }).fill("175");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("spinbutton", { name: "Current weight" }).fill("75");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "How old are you?" })).toBeVisible();

  // Recovery is part of the user-facing contract: a refresh must keep the
  // authoritative server-derived next step instead of restarting the funnel.
  await page.reload();
  await expect(page.getByRole("heading", { name: "How old are you?" })).toBeVisible();

  await page.getByRole("spinbutton", { name: "Age" }).fill("24");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("spinbutton", { name: "Target weight" }).fill("68");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/result$/);
  await expect(
    page.getByRole("heading", { name: "Your wellness profile" }),
  ).toBeVisible();
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
