import { expect, test } from "@playwright/test";

test("filtering the Inbox by company and employment type narrows the list, and Clear filters resets it", async ({
  page,
}) => {
  await page.goto("/inbox");
  await expect(page.getByText("Software Engineer, Platform")).toBeVisible();
  await expect(page.getByText("Data Analyst Intern")).toBeVisible();

  // Type-ahead: typing part of a company name suggests it, with a checkmark once selected.
  await page.getByPlaceholder("Filter by company…").fill("Init");
  const suggestion = page.getByRole("button", { name: "Initech" });
  await expect(suggestion).toBeVisible();
  await suggestion.click();

  // Selecting narrows the list to that company only — the other company's job disappears, and
  // the URL carries the filter so it survives a reload/share.
  await expect(page.getByText("Data Analyst Intern")).toBeVisible();
  await expect(page.getByText("Software Engineer, Platform")).toHaveCount(0);
  await expect(page).toHaveURL(/companies=/);

  // The employment-type toggle further narrows — Initech's only NEW job is an internship, so
  // filtering to Full Time (mutually exclusive here) should hide it too, leaving nothing.
  await page.getByRole("button", { name: "FULL TIME", exact: true }).click();
  await expect(page.getByText("Data Analyst Intern")).toHaveCount(0);
  await expect(page.getByText("All caught up")).toBeVisible();

  // Clearing drops both filters and restores the full list.
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText("Software Engineer, Platform")).toBeVisible();
  await expect(page.getByText("Data Analyst Intern")).toBeVisible();
  await expect(page).not.toHaveURL(/companies=|types=/);
});
