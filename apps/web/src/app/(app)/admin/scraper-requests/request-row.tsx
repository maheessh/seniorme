"use client";

import type { SupportRequestStatus } from "@ccc/db";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SupportRequestForAdmin } from "@/lib/server/services/support-requests";
import { setSupportRequestStatusAction } from "./actions";

const STATUS_VARIANT: Record<SupportRequestStatus, "warning" | "primary" | "success"> = {
  OPEN: "warning",
  IN_PROGRESS: "primary",
  RESOLVED: "success",
};

const STATUS_LABEL: Record<SupportRequestStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

export function RequestRow({ request }: { request: SupportRequestForAdmin }) {
  const [pending, startTransition] = useTransition();

  function move(status: SupportRequestStatus) {
    startTransition(() => void setSupportRequestStatusAction(request.id, status));
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{request.companyName}</span>
            <Badge variant={STATUS_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Requested by {request.user.email} · {formatDistanceToNow(request.createdAt, { addSuffix: true })}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {request.status !== "IN_PROGRESS" ? (
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => move("IN_PROGRESS")}>
              Mark in progress
            </Button>
          ) : null}
          {request.status !== "RESOLVED" ? (
            <Button type="button" size="sm" disabled={pending} onClick={() => move("RESOLVED")}>
              Mark resolved
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => move("OPEN")}>
              Reopen
            </Button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-muted-foreground">Source</dt>
          <dd className="min-w-0">
            <a
              href={request.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 truncate text-primary hover:underline"
            >
              <span className="truncate">{request.sourceUrl}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-muted-foreground">Domain</dt>
          <dd className="min-w-0 truncate">{request.domain ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-muted-foreground">Website</dt>
          <dd className="min-w-0 truncate">
            {request.website ? (
              <a href={request.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {request.website}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      {request.errorMessage ? (
        <div className="rounded-lg bg-muted/60 p-2.5">
          <p className="text-xs font-medium text-muted-foreground">Scrape error</p>
          <p className="mt-1 break-words font-mono text-xs text-destructive">{request.errorMessage}</p>
        </div>
      ) : null}
    </div>
  );
}
