import { expect, test } from "@playwright/test";

test("triaging a discovered job in the Inbox moves it into the Pipeline", async ({ page }) => {
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "Inbox", level: 1 })).toBeVisible();

  const row = page.locator(".rounded-xl", { hasText: "Software Engineer, Platform" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Apply" }).click();

  // Optimistic removal — the row should disappear from the New tab immediately.
  await expect(page.getByText("Software Engineer, Platform")).toHaveCount(0);

  await page.goto("/pipeline?view=table");
  await expect(page.getByText("Software Engineer, Platform")).toBeVisible();
});
