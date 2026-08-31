import { expect, test } from "@playwright/test";

test("adding a company and a career source, then triggering a scrape", async ({ page }) => {
  await page.goto("/companies");
  await expect(page.getByRole("heading", { name: "Companies", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Add company" }).click();
  const companyDialog = page.getByRole("dialog");
  await companyDialog.getByLabel("Name").fill("Globex E2E");
  await companyDialog.getByRole("button", { name: "Add company", exact: true }).click();
  await expect(page.getByText("Globex E2E")).toBeVisible();

  const card = page.locator(".rounded-xl", { hasText: "Globex E2E" });
  await card.getByRole("button", { name: /Manage career pages/ }).click();

  const sourcesDialog = page.getByRole("dialog");
  await sourcesDialog.getByPlaceholder("https://boards.greenhouse.io/company").fill("https://boards.greenhouse.io/globex-e2e-fixture");
  await sourcesDialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sourcesDialog.getByText("https://boards.greenhouse.io/globex-e2e-fixture")).toBeVisible();
  await sourcesDialog.getByRole("button", { name: "Close" }).click();

  // Triggering the scrape only asserts the app correctly enqueues/responds — it doesn't wait
  // for a real network fetch to complete, which would make this test depend on an external
  // site being reachable. The worker's own scrape/upsert logic is covered by its integration
  // tests against a real database instead.
  await card.getByRole("button", { name: "Scrape now" }).click();
  await expect(page.getByText(/Scraping 1 career page|checked recently/i)).toBeVisible({ timeout: 10_000 });
});
