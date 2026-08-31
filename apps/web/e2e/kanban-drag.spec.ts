import { expect, test } from "@playwright/test";

test("dragging a card across Kanban columns moves it to the new stage", async ({ page }) => {
  await page.goto("/pipeline");
  await expect(page.getByRole("heading", { name: "Pipeline", level: 1 })).toBeVisible();

  const card = page.locator('[role="button"][aria-roledescription="draggable"]', {
    hasText: "Senior Backend Engineer",
  });
  await expect(card).toBeVisible();

  const preparingColumn = page.getByText("Preparing", { exact: true });
  const sourceBox = await card.boundingBox();
  const targetBox = await preparingColumn.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Could not measure drag source/target");

  // dnd-kit's PointerSensor has a 6px activation distance — a plain drag-and-drop API call
  // (or a single large mouse.move) can land under that threshold and never start a drag, so
  // this moves in a few discrete steps to reliably cross it before releasing over the target.
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 10, sourceBox.y + sourceBox.height / 2 + 10);
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 40, { steps: 10 });
  // handleDragEnd fires moveStageAction as a fire-and-forget transition (no UI "saved"
  // confirmation to wait on) — wait for that Server Action's POST to actually resolve before
  // asserting persistence, or a reload right after mouse.up() races the mutation and reads stale
  // server data.
  const persisted = page.waitForResponse((res) => res.request().method() === "POST" && res.url().includes("/pipeline"));
  await page.mouse.up();
  await persisted;

  const preparingColumnCard = page.locator(".rounded-xl", { hasText: "Preparing" });
  await expect(preparingColumnCard.getByText("Senior Backend Engineer")).toBeVisible();

  // The stage change persists server-side, not just in optimistic client state.
  await page.reload();
  await expect(preparingColumnCard.getByText("Senior Backend Engineer")).toBeVisible();
});
