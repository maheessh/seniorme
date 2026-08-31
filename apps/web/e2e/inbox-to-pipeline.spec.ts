import { expect, test } from "@playwright/test";

test("triaging a discovered job in the Inbox moves it into the Pipeline", async ({ page }) => {
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "Inbox", level: 1 })).toBeVisible();

  const row = page.locator(".rounded-xl", { hasText: "Software Engineer, Platform" });
  await expect(row).toBeVisible();
  // setInboxStatusAction (which creates the Application row) fires as a fire-and-forget
  // transition — wait for that Server Action's POST to resolve before navigating away, or the
  // Pipeline page can load before the Application actually exists (verified live: without this,
  // the test flaked exactly that way).
  const persisted = page.waitForResponse((res) => res.request().method() === "POST" && res.url().includes("/inbox"));
  await row.getByRole("button", { name: "Apply" }).click();

  // Optimistic removal — the row should disappear from the New tab immediately.
  await expect(page.getByText("Software Engineer, Platform")).toHaveCount(0);
  await persisted;

  await page.goto("/pipeline?view=table");
  await expect(page.getByText("Software Engineer, Platform")).toBeVisible();
});
