import { Bell } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function NotificationsPage() {
  return (
    <EmptyState
      icon={Bell}
      title="Notifications are coming in Phase 8"
      description="New matching jobs, approaching deadlines, follow-up reminders, and scraper health alerts will show up here."
    />
  );
}
