import { expect, test } from "@playwright/test";

test("creating a project and updating its progress", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Add project" }).click();
  const projectDialog = page.getByRole("dialog");
  await projectDialog.getByLabel("Name").fill("Portfolio Redesign");
  await projectDialog.getByLabel(/^Progress/).fill("25");
  await projectDialog.getByRole("button", { name: "Add project", exact: true }).click();

  await expect(page.getByText("Portfolio Redesign")).toBeVisible();
  await expect(page.getByText("25%")).toBeVisible();
});

test("creating a goal and incrementing its progress", async ({ page }) => {
  await page.goto("/goals");
  await expect(page.getByRole("heading", { name: "Goals", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Add goal" }).click();
  const goalDialog = page.getByRole("dialog");
  await goalDialog.getByLabel("Title").fill("Ship 3 side projects");
  await goalDialog.getByLabel("Target (optional)").fill("3");
  await goalDialog.getByRole("button", { name: "Add goal", exact: true }).click();

  const card = page.locator(".rounded-xl", { hasText: "Ship 3 side projects" });
  await expect(card).toBeVisible();
  await expect(card.getByText("0/3")).toBeVisible();

  await card.getByRole("button", { name: "Increase progress" }).click();
  await expect(card.getByText("1/3")).toBeVisible();
});
