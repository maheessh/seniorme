import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function AnalyticsPage() {
  return (
    <EmptyState
      icon={BarChart3}
      title="Analytics are coming in Phase 7"
      description="Funnel conversion, applications over time, stage duration, and more — once there's pipeline data to analyze."
    />
  );
}
