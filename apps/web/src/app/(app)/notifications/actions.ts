"use server";

import { revalidatePath } from "next/cache";
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/server/services/notifications";

export async function markNotificationReadAction(id: string): Promise<void> {
  await markNotificationRead(id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  await markAllNotificationsRead();
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function deleteNotificationAction(id: string): Promise<void> {
  await deleteNotification(id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
