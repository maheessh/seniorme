import { Kanban } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function PipelinePage() {
  return (
    <EmptyState
      icon={Kanban}
      title="Application pipeline is coming in Phase 4"
      description="Your Kanban and table views of every application — from discovered through offer — will live here."
    />
  );
}
