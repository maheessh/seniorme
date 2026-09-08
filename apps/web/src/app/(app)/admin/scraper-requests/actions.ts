"use server";

import type { SupportRequestStatus } from "@ccc/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/auth-helpers";
import { setSupportRequestStatus } from "@/lib/server/services/support-requests";

export async function setSupportRequestStatusAction(
  requestId: string,
  status: SupportRequestStatus,
): Promise<void> {
  await requireAdmin();
  await setSupportRequestStatus(requestId, status);
  revalidatePath("/admin/scraper-requests");
}
