"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { differenceInDays, formatDistanceToNow, isPast } from "date-fns";
import { ExternalLink } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { cn } from "@/lib/utils";
import type { ApplicationWithRelations } from "@/lib/server/services/applications";

/** Postings older than this read as "way too old to bother with" rather than fresh. */
const STALE_POSTING_DAYS = 30;

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
  const postedAt = application.job.postedAt;
  const postedDaysAgo = postedAt ? differenceInDays(new Date(), postedAt) : null;
  const postedStale = postedDaysAgo !== null && postedDaysAgo > STALE_POSTING_DAYS;

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
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{application.job.title}</p>
          <p className="truncate text-xs text-muted-foreground">{application.company.name}</p>
        </div>
        <a
          href={application.job.url}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          aria-label="Open posting"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      {postedAt ? (
        <p className={cn("text-xs", postedStale ? "text-warning" : "text-muted-foreground")}>
          Posted {formatDistanceToNow(postedAt, { addSuffix: true })}
        </p>
      ) : null}
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
