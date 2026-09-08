"use client";

import type { CareerSource } from "@ccc/db";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, LifeBuoy, RefreshCw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteCareerSourceAction,
  requestScraperSupportAction,
  toggleCareerSourceActiveAction,
  triggerScrapeAction,
} from "./career-sources-actions";

export function CareerSourceRow({
  source,
  companyId,
  alreadyRequested = false,
}: {
  source: CareerSource;
  companyId: string;
  alreadyRequested?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [requested, setRequested] = useState(alreadyRequested);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Our scraper couldn't handle this board — offer to send it to the team to build support.
  const hasError = source.consecutiveFailures > 0 || Boolean(source.lastError);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-medium hover:underline"
          >
            {source.url}
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge>{source.sourceType}</Badge>
            {source.isActive ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge>Paused</Badge>
            )}
            {source.consecutiveFailures > 0 ? (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3" /> {source.consecutiveFailures} failed check
                {source.consecutiveFailures === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Refresh now"
            disabled={pending}
            onClick={() => {
              setRefreshError(null);
              startTransition(async () => {
                const result = await triggerScrapeAction(source.id);
                if (result.error) setRefreshError(result.error);
              });
            }}
          >
            <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={source.isActive ? "Pause monitoring" : "Resume monitoring"}
            onClick={() =>
              startTransition(() => void toggleCareerSourceActiveAction(source.id, !source.isActive))
            }
          >
            {source.isActive ? "Pause" : "Resume"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove career page"
            onClick={() => startTransition(() => void deleteCareerSourceAction(source.id))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {source.lastSuccessAt
          ? `Last checked successfully ${formatDistanceToNow(source.lastSuccessAt, { addSuffix: true })}`
          : source.lastCheckedAt
            ? `Checked ${formatDistanceToNow(source.lastCheckedAt, { addSuffix: true })} — no successful check yet`
            : "Not checked yet"}
      </div>

      {source.lastError ? (
        <p className="text-xs text-destructive">{source.lastError}</p>
      ) : null}
      {refreshError ? <p className="text-xs text-destructive">{refreshError}</p> : null}

      {hasError ? (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          {requested ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LifeBuoy className="h-3.5 w-3.5" />
              Sent to the team — we&apos;ll notify you when scraping support is ready.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Can&apos;t scrape this board? Send it to us to build support.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setRequestError(null);
                  startTransition(async () => {
                    const result = await requestScraperSupportAction(companyId, source.id);
                    if (result.error) setRequestError(result.error);
                    else setRequested(true);
                  });
                }}
              >
                <LifeBuoy className="h-3.5 w-3.5" /> Request support
              </Button>
            </div>
          )}
          {requestError ? <p className="text-xs text-destructive">{requestError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
