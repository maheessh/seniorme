"use server";

import type { InboxStatus } from "@ccc/db";
import { revalidatePath } from "next/cache";
import { bulkSetInboxStatus, clearPossibleDuplicate, setInboxStatus } from "@/lib/server/services/inbox";

export async function setInboxStatusAction(jobId: string, status: InboxStatus): Promise<void> {
  await setInboxStatus(jobId, status);
  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function bulkSetInboxStatusAction(jobIds: string[], status: InboxStatus): Promise<void> {
  if (jobIds.length === 0) return;
  await bulkSetInboxStatus(jobIds, status);
  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function clearPossibleDuplicateAction(jobId: string): Promise<void> {
  await clearPossibleDuplicate(jobId);
  revalidatePath("/inbox");
}
