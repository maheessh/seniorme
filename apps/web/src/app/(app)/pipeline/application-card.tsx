"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow, isPast } from "date-fns";
import { CompanyLogo } from "@/components/company-logo";
import { cn } from "@/lib/utils";
import type { ApplicationWithRelations } from "@/lib/server/services/applications";

export function ApplicationCard({
  application,
  onClick,
}: {
  application: ApplicationWithRelations;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const deadlineSoon = application.deadline && !isPast(application.deadline);
  const deadlinePast = application.deadline && isPast(application.deadline);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "flex cursor-grab flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "z-10 opacity-50 shadow-lg",
      )}
    >
      <div className="flex items-start gap-2">
        <CompanyLogo logoUrl={application.company.logoUrl} name={application.company.name} size={24} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{application.job.title}</p>
          <p className="truncate text-xs text-muted-foreground">{application.company.name}</p>
        </div>
      </div>
      {application.deadline ? (
        <p className={cn("text-xs", deadlinePast ? "text-destructive" : deadlineSoon ? "text-warning" : "text-muted-foreground")}>
          Deadline {formatDistanceToNow(application.deadline, { addSuffix: true })}
        </p>
      ) : null}
      {application.contact ? (
        <p className="truncate text-xs text-muted-foreground">Contact: {application.contact.name}</p>
      ) : null}
    </div>
  );
}
