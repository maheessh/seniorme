"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/server/auth-helpers";
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/server/services/notifications";

export async function markNotificationReadAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await markNotificationRead(userId, id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const userId = await requireUserId();
  await markAllNotificationsRead(userId);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function deleteNotificationAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await deleteNotification(userId, id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
