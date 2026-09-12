import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function completeDefaultAssessment(
  page: Page,
  options: { reloadBeforeAge?: boolean } = {},
) {
  await page.goto("/");

  const start = page.getByRole("link", { name: "Start my assessment" });
  await expect(start).toBeVisible();
  await expect(start).toHaveAttribute(
    "href",
    /\/assessment\?order=[0-9a-f-]{36}$/i,
  );
  await start.click();

  await expect(page).toHaveURL(/\/assessment\?order=[0-9a-f-]{36}$/i);
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
  await expect(page.getByText("Your BMI", { exact: true })).toBeVisible();
  await expect(page.getByText("24.5", { exact: true })).toBeVisible();
  await expect(page.getByText("Within the standard range", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "How old are you?" })).toBeVisible();

  if (options.reloadBeforeAge) {
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "How old are you?" }),
    ).toBeVisible();
  }

  await page.getByRole("spinbutton", { name: "Age" }).fill("24");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("spinbutton", { name: "Target weight" }).fill("68");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/result\?order=[0-9a-f-]{36}$/i);
  await expect(
    page.getByRole("heading", { name: "Your wellness profile" }),
  ).toBeVisible();
}
