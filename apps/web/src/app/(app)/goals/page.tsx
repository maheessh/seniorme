import { Target } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function GoalsPage() {
  return (
    <EmptyState
      icon={Target}
      title="Goals tracker is coming in Phase 6"
      description="Set targets — applications sent, problems solved, resume polish — and track progress with milestones."
    />
  );
}
