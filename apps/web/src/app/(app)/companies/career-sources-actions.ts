"use server";

import { careerSourceInputSchema } from "@ccc/shared";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/server/auth-helpers";
import {
  addCareerSource,
  deleteCareerSource,
  setCareerSourceActive,
  triggerCompanyScrape,
  triggerScrape,
  TriggerTooSoonError,
} from "@/lib/server/services/career-sources";
import { createSupportRequest, SupportRequestError } from "@/lib/server/services/support-requests";

export async function requestScraperSupportAction(
  companyId: string,
  careerSourceId: string,
): Promise<{ error?: string; ok?: true }> {
  const userId = await requireUserId();
  try {
    await createSupportRequest(userId, { companyId, careerSourceId });
  } catch (error) {
    if (error instanceof SupportRequestError) return { error: error.message };
    return { error: "Couldn't send the request. Try again." };
  }
  revalidatePath("/companies");
  return { ok: true };
}

export type CareerSourceFormState = { error?: string; ok?: true } | undefined;

export async function addCareerSourceAction(
  companyId: string,
  _prevState: CareerSourceFormState,
  formData: FormData,
): Promise<CareerSourceFormState> {
  const parsed = careerSourceInputSchema.safeParse({
    companyId,
    url: formData.get("url"),
    checkFrequencyMin: formData.get("checkFrequencyMin") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await addCareerSource(parsed.data.companyId, parsed.data.url, parsed.data.checkFrequencyMin);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to add source" };
  }

  revalidatePath("/companies");
  return { ok: true };
}

export async function deleteCareerSourceAction(id: string): Promise<void> {
  await deleteCareerSource(id);
  revalidatePath("/companies");
}

export async function toggleCareerSourceActiveAction(id: string, isActive: boolean): Promise<void> {
  await setCareerSourceActive(id, isActive);
  revalidatePath("/companies");
}

export async function triggerScrapeAction(id: string): Promise<{ error?: string }> {
  try {
    await triggerScrape(id);
  } catch (error) {
    if (error instanceof TriggerTooSoonError) {
      const minutes = Math.ceil(error.retryAfterMs / 60_000);
      return { error: `Checked recently — try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.` };
    }
    return { error: error instanceof Error ? error.message : "Failed to trigger a scrape" };
  }

  revalidatePath("/companies");
  return {};
}

export async function triggerCompanyScrapeAction(companyId: string): Promise<{ error?: string; message?: string }> {
  const { queued, skipped } = await triggerCompanyScrape(companyId);

  if (queued === 0 && skipped === 0) {
    return { error: "No active career pages to scrape — add one first." };
  }
  if (queued === 0) {
    return { error: "All career pages were checked recently — try again shortly." };
  }

  revalidatePath("/companies");
  return {
    message: `Scraping ${queued} career page${queued === 1 ? "" : "s"}…${skipped > 0 ? ` (${skipped} skipped, checked recently)` : ""}`,
  };
}
