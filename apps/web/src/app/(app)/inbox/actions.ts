"use server";

import type { InboxStatus } from "@ccc/db";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/server/auth-helpers";
import { searchCompanies } from "@/lib/server/services/companies";
import { bulkSetInboxStatus, clearPossibleDuplicate, setInboxStatus } from "@/lib/server/services/inbox";

export async function searchCompaniesAction(query: string) {
  const userId = await requireUserId();
  return searchCompanies(userId, query);
}

export async function setInboxStatusAction(jobId: string, status: InboxStatus): Promise<void> {
  const userId = await requireUserId();
  await setInboxStatus(userId, jobId, status);
  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function bulkSetInboxStatusAction(jobIds: string[], status: InboxStatus): Promise<void> {
  if (jobIds.length === 0) return;
  const userId = await requireUserId();
  await bulkSetInboxStatus(userId, jobIds, status);
  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function clearPossibleDuplicateAction(jobId: string): Promise<void> {
  await clearPossibleDuplicate(jobId);
  revalidatePath("/inbox");
}
