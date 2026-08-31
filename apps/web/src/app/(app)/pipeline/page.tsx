import type { ApplicationStage } from "@ccc/db";
import { ALL_STAGES } from "@ccc/shared";
import { Kanban } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { getApplicationsByStage, listApplications } from "@/lib/server/services/applications";

export const metadata: Metadata = { title: "Pipeline" };
import { PipelineBoard } from "./pipeline-board";
import { PipelineTable } from "./pipeline-table";
import { PipelineToolbar } from "./pipeline-toolbar";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; search?: string; stage?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "table" ? "table" : "kanban";
  const stage =
    params.stage && (ALL_STAGES as string[]).includes(params.stage)
      ? (params.stage as ApplicationStage)
      : undefined;

  const grouped = view === "kanban" ? await getApplicationsByStage() : null;
  const rows = view === "table" ? await listApplications({ stage, search: params.search }) : null;

  const hasAnyApplications = grouped
    ? Object.values(grouped).some((apps) => apps.length > 0)
    : (rows?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Track every application from discovered through offer. Drag cards between stages, or
          use the table for a dense view.
        </p>
      </div>

      {hasAnyApplications ? (
        <>
          <PipelineToolbar />
          {grouped ? <PipelineBoard grouped={grouped} /> : <PipelineTable applications={rows ?? []} />}
        </>
      ) : (
        <EmptyState
          icon={Kanban}
          title="No applications yet"
          description="Applications you mark 'Apply' on from the Inbox will show up here — track every stage from discovered through offer."
        />
      )}
    </div>
  );
}
