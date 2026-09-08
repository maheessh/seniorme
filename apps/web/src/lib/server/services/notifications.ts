import { prisma } from "@ccc/db";

const LIST_LIMIT = 100;

export function getNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
  });
}

export function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markNotificationRead(userId: string, id: string) {
  await prisma.notification.findFirstOrThrow({ where: { id, userId } });
  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}

export async function deleteNotification(userId: string, id: string) {
  await prisma.notification.findFirstOrThrow({ where: { id, userId } });
  return prisma.notification.delete({ where: { id } });
}
