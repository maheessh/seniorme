import { Bell } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { getNotifications } from "@/lib/server/services/notifications";
import { MarkAllReadButton } from "./mark-all-read-button";
import { NotificationRow } from "./notification-row";

export default async function NotificationsPage() {
  const notifications = await getNotifications();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            New matching jobs, approaching deadlines, follow-up reminders, and scraper health
            alerts.
          </p>
        </div>
        <MarkAllReadButton disabled={unreadCount === 0} />
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="New matching jobs, approaching deadlines, follow-up reminders, and scraper health alerts will show up here as they happen."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}
