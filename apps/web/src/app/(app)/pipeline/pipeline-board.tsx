"use client";

import type { ApplicationStage } from "@ccc/db";
import { ALL_STAGES, STAGE_LABEL } from "@ccc/shared";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useState, useTransition } from "react";
import type { ApplicationWithRelations } from "@/lib/server/services/applications";
import { cn } from "@/lib/utils";
import { moveStageAction } from "./actions";
import { ApplicationCard } from "./application-card";
import { ApplicationDetailDialog } from "./application-detail-dialog";

function Column({
  stage,
  applications,
  onCardClick,
}: {
  stage: ApplicationStage;
  applications: ApplicationWithRelations[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/30 p-2.5",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-xs font-medium text-muted-foreground">{STAGE_LABEL[stage]}</span>
        <span className="text-xs text-muted-foreground">{applications.length}</span>
      </div>
      <div className="flex min-h-8 flex-col gap-2">
        {applications.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            onClick={() => onCardClick(application.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function PipelineBoard({
  grouped,
}: {
  grouped: Record<ApplicationStage, ApplicationWithRelations[]>;
}) {
  const [columns, setColumns] = useState(grouped);
  const [openId, setOpenId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // `grouped` is a fresh object every time the server re-renders this page (e.g. after
  // router.refresh() from the detail dialog's stage dropdown). Re-sync our optimistic local
  // copy to it during render — not in an effect — so it doesn't fight with handleDragEnd's own
  // setColumns calls on ordinary client re-renders where `grouped` hasn't actually changed.
  const [syncedGrouped, setSyncedGrouped] = useState(grouped);
  if (grouped !== syncedGrouped) {
    setSyncedGrouped(grouped);
    setColumns(grouped);
  }

  // KeyboardSensor makes the board operable without a pointer: Tab to a card, Space to pick it
  // up, arrow keys to move between columns, Space to drop, Escape to cancel — dnd-kit wires this
  // up automatically once a card's draggable attributes/listeners are on a focusable element
  // (ApplicationCard already spreads them onto its root div).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function describeCard(id: string): string {
    const application = Object.values(columns)
      .flat()
      .find((app) => app.id === id);
    return application ? `${application.job.title} at ${application.company.name}` : "card";
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describeCard(active.id as string)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${describeCard(active.id as string)} is over the ${STAGE_LABEL[over.id as ApplicationStage]} column.`
        : `${describeCard(active.id as string)} is no longer over a column.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Moved ${describeCard(active.id as string)} to ${STAGE_LABEL[over.id as ApplicationStage]}.`
        : `${describeCard(active.id as string)} was dropped outside any column — no change made.`,
    onDragCancel: ({ active }) => `Cancelled moving ${describeCard(active.id as string)}.`,
  };

  function handleDragEnd(event: DragEndEvent) {
    const applicationId = event.active.id as string;
    const toStage = event.over?.id as ApplicationStage | undefined;
    if (!toStage) return;

    setColumns((prev) => {
      let moved: ApplicationWithRelations | undefined;
      const next = Object.fromEntries(
        Object.entries(prev).map(([stage, apps]) => {
          if (stage === toStage) return [stage, apps];
          const filtered = apps.filter((application) => {
            if (application.id === applicationId) {
              moved = application;
              return false;
            }
            return true;
          });
          return [stage, filtered];
        }),
      ) as Record<ApplicationStage, ApplicationWithRelations[]>;

      if (moved && moved.stage !== toStage) {
        next[toStage] = [{ ...moved, stage: toStage }, ...next[toStage]];
      }
      return next;
    });

    startTransition(() => {
      void moveStageAction(applicationId, toStage);
    });
  }

  return (
    <>
      <DndContext
        id="pipeline-board"
        sensors={sensors}
        onDragEnd={handleDragEnd}
        accessibility={{ announcements }}
      >
        <div className="flex gap-3 overflow-x-auto pb-3">
          {ALL_STAGES.map((stage) => (
            <Column key={stage} stage={stage} applications={columns[stage]} onCardClick={setOpenId} />
          ))}
        </div>
      </DndContext>
      <ApplicationDetailDialog applicationId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
