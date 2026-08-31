import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function ProjectsPage() {
  return (
    <EmptyState
      icon={FolderKanban}
      title="Senior-year project tracker is coming in Phase 6"
      description="Track project status, milestones, and progress toward completion here."
    />
  );
}
