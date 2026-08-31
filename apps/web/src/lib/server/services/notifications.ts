import { prisma } from "@ccc/db";

const LIST_LIMIT = 100;

export function getNotifications() {
  return prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
  });
}

export function getUnreadNotificationCount() {
  return prisma.notification.count({ where: { isRead: false } });
}

export function markNotificationRead(id: string) {
  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export function markAllNotificationsRead() {
  return prisma.notification.updateMany({ where: { isRead: false }, data: { isRead: true } });
}

export function deleteNotification(id: string) {
  return prisma.notification.delete({ where: { id } });
}
