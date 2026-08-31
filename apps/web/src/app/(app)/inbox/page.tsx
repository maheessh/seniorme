import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function InboxPage() {
  return (
    <EmptyState
      icon={Inbox}
      title="Discovery inbox is coming in Phase 3"
      description="Once career-page monitoring (Phase 2) is live, newly discovered jobs will land here for fast triage — interested, saved, or ignored."
    />
  );
}
