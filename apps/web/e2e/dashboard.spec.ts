import { expect, test } from "@playwright/test";

test("landing page shows branding and enters the app", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Senior Me" })).toBeVisible();
  await page.getByRole("link", { name: "Enter" }).click();
  await expect(page.getByRole("heading", { name: "Here's where things stand." })).toBeVisible();
});

test("dashboard loads with real KPI data", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Here's where things stand." })).toBeVisible();

  // Asserts a real (non-zero) count rendered rather than an exact value — other spec files in
  // this suite share the same seeded database and add their own companies/applications, so an
  // exact count here would depend on test execution order.
  const companiesCard = page.locator(".rounded-xl.border-border", { hasText: "Companies tracked" });
  await expect(companiesCard.locator("div.font-display")).not.toHaveText("0");

  const applicationsCard = page.locator(".rounded-xl.border-border", { hasText: "Applications submitted" });
  await expect(applicationsCard.locator("div.font-display")).not.toHaveText("0");
});

test("sidebar navigates to every page without a full reload", async ({ page }) => {
  await page.goto("/dashboard");
  for (const [label, heading] of [
    ["Inbox", "Inbox"],
    ["Pipeline", "Pipeline"],
    ["Companies", "Companies"],
    ["Projects", "Projects"],
    ["Goals", "Goals"],
    ["Analytics", "Analytics"],
    ["Notifications", "Notifications"],
  ] as const) {
    await page.getByRole("link", { name: label }).click();
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
});
