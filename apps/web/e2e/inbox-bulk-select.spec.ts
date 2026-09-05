import { expect, test } from "@playwright/test";

test("filtering to a company, selecting all its jobs, and bulk-ignoring them moves them out of New", async ({
  page,
}) => {
  await page.goto("/inbox");

  // Scope to Vandelay Industries' two dedicated fixture jobs first — bulk-selecting without
  // filtering would sweep up every other spec's fixture jobs too, since New holds everything.
  await page.getByPlaceholder("Filter by company…").fill("Vandelay");
  await page.getByRole("button", { name: "Vandelay Industries" }).click();
  await expect(page.getByText("QA Engineer")).toBeVisible();
  await expect(page.getByText("DevOps Engineer")).toBeVisible();

  await page.getByRole("checkbox", { name: "Select all" }).check();
  await expect(page.getByText("2 selected")).toBeVisible();

  // bulkSetInboxStatusAction (which persists the status change) fires as a fire-and-forget
  // transition — wait for that Server Action's POST to resolve before navigating away, or the
  // Ignored tab can load before the jobs are actually persisted there (the same flake pattern
  // documented in inbox-to-pipeline.spec.ts for the single-job action).
  const persisted = page.waitForResponse((res) => res.request().method() === "POST" && res.url().includes("/inbox"));
  // Each row also has its own per-row "Ignore" icon button (aria-label="Ignore"), so scope to the
  // bulk toolbar specifically rather than matching any button named "Ignore" on the page.
  await page.getByRole("toolbar", { name: "Bulk actions" }).getByRole("button", { name: "Ignore" }).click();

  // Optimistic removal — both should disappear from New immediately.
  await expect(page.getByText("QA Engineer")).toHaveCount(0);
  await expect(page.getByText("DevOps Engineer")).toHaveCount(0);
  await expect(page.getByText("All caught up")).toBeVisible();
  await persisted;

  // And they should have actually persisted as Ignored, not just vanished from view.
  await page.goto("/inbox?status=IGNORED");
  await page.getByPlaceholder("Filter by company…").fill("Vandelay");
  await page.getByRole("button", { name: "Vandelay Industries" }).click();
  await expect(page.getByText("QA Engineer")).toBeVisible();
  await expect(page.getByText("DevOps Engineer")).toBeVisible();
});

test("deselecting one of several selected jobs shows an indeterminate 'select all' state", async ({ page }) => {
  await page.goto("/inbox");
  // A separate company/pair of jobs from the bulk-ignore test above — globalSetup seeds once for
  // the whole run, not per test, so reusing Vandelay's (by-then-ignored) jobs here would fail
  // regardless of which test happens to run first.
  await page.getByPlaceholder("Filter by company…").fill("Sterling");
  await page.getByRole("button", { name: "Sterling Cooper" }).click();
  await expect(page.getByText("Support Engineer")).toBeVisible();

  await page.getByRole("checkbox", { name: "Select all" }).check();
  await expect(page.getByText("2 selected")).toBeVisible();

  await page.getByRole("checkbox", { name: "Select Backend Engineer, Platform" }).uncheck();
  await expect(page.getByText("1 selected")).toBeVisible();

  const selectAll = page.getByRole("checkbox", { name: "Select all" });
  await expect(selectAll).not.toBeChecked();
  expect(await selectAll.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(true);

  // Clearing drops the selection and hides the bulk toolbar again.
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByText("1 selected")).toHaveCount(0);
});
