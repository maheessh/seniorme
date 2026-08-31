import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function CompaniesPage() {
  return (
    <EmptyState
      icon={Building2}
      title="Company tracker is coming in Phase 1"
      description="Add companies you're targeting, their career pages, and enable automated monitoring — this section is next up on the roadmap."
    />
  );
}
