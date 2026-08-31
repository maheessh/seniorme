import { expect, test } from "@playwright/test";

test("job-link import: extraction failure falls back to manual entry", async ({ page }) => {
  await page.goto("/inbox");
  await page.getByRole("button", { name: "Import job" }).click();

  const dialog = page.getByRole("dialog");
  // 127.0.0.1 is blocked by the SSRF guard before any real network request goes out — this
  // makes the failure path deterministic and network-independent, unlike pointing at a real
  // job board (which the extraction *happy* path already covers via packages/scraper's own
  // JSON-LD/ATS-API unit tests — this test is about the app's own fallback UI, not re-testing
  // extraction reliability against a live site).
  await dialog.getByPlaceholder("https://jobs.example.com/openings/123").fill("http://127.0.0.1:1/fake-job");
  await dialog.getByRole("button", { name: "Fetch" }).click();

  // A blocked/failed fetch doesn't just show an error and stop — it falls straight through to
  // the manual-entry form (source: "none") with the failure reason shown as context, rather than
  // requiring an extra "skip extraction" click. That's the actual fallback UX being verified here.
  await expect(dialog.getByText(/private|internal|refus/i)).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText("Automatic extraction didn't find much")).toBeVisible();

  await dialog.getByLabel("Job title").fill("Manually Entered Role");
  await dialog.getByLabel("Company").fill("Manual Import Co");
  await dialog.getByLabel("Add directly to the pipeline as Applied").uncheck();
  await dialog.getByRole("button", { name: "Save job" }).click();

  await expect(dialog).toBeHidden();

  // Unchecking "add to pipeline" above means the import lands as a Saved inbox job, not on the
  // New tab this page started on (see setInboxStatus in job-import.ts: addToPipeline false -> SAVED).
  await page.goto("/inbox?status=SAVED");
  await expect(page.getByText("Manually Entered Role")).toBeVisible();
});
