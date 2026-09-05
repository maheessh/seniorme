"use client";

import type { InboxStatus } from "@ccc/db";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Inbox as InboxIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { EmptyState } from "@/components/empty-state";
import type { InboxJob } from "@/lib/server/services/inbox";
import { bulkSetInboxStatusAction, clearPossibleDuplicateAction, setInboxStatusAction } from "./actions";
import { InboxRow } from "./inbox-row";

const SHORTCUT_TO_STATUS: Record<string, InboxStatus> = {
  s: "SAVED",
  a: "APPLIED",
  g: "IGNORED",
};

const BULK_ACTIONS: { status: InboxStatus; label: string }[] = [
  { status: "SAVED", label: "Save" },
  { status: "APPLIED", label: "Apply" },
  { status: "IGNORED", label: "Ignore" },
];

// A row's collapsed height (~90px, one company logo + title + badges line) is a reasonable
// estimate for the virtualizer's initial layout pass — actual heights (which vary with badge
// count and, once expanded, the description) are measured per-row via measureElement below.
const ESTIMATED_ROW_HEIGHT = 92;

export function InboxList({ jobs, emptyLabel }: { jobs: InboxJob[]; emptyLabel: string }) {
  const [items, setItems] = useState(jobs);
  const [rawFocusedIndex, setFocusedIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  const act = useCallback((jobId: string, status: InboxStatus) => {
    setItems((prev) => prev.filter((job) => job.id !== jobId));
    setSelectedIds((prev) => {
      if (!prev.has(jobId)) return prev;
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
    startTransition(() => {
      void setInboxStatusAction(jobId, status);
    });
  }, []);

  const bulkAct = useCallback(
    (status: InboxStatus) => {
      const jobIds = [...selectedIds];
      if (jobIds.length === 0) return;
      setItems((prev) => prev.filter((job) => !selectedIds.has(job.id)));
      setSelectedIds(new Set());
      startTransition(() => {
        void bulkSetInboxStatusAction(jobIds, status);
      });
    },
    [selectedIds],
  );

  const toggleSelect = useCallback((jobId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => (prev.size > 0 ? new Set() : new Set(items.map((job) => job.id))));
  }, [items]);

  const dismissDuplicate = useCallback((jobId: string) => {
    setItems((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, possibleDuplicateOf: null } : job)),
    );
    startTransition(() => {
      void clearPossibleDuplicateAction(jobId);
    });
  }, []);

  // Derived at render time (not synced via effect) so it's always in bounds even right after
  // an optimistic removal shrinks `items`, without a redundant render-then-clamp effect.
  const focusedIndex = Math.min(rawFocusedIndex, Math.max(items.length - 1, 0));
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  // Renders only the rows near the viewport regardless of list length — with career-page
  // pagination now pulling in a full board's worth of postings per company (hundreds, not
  // dozens), the New tab routinely holds well over 100 jobs, and unvirtualized this mounted
  // every row's DOM (logo image, several badges, five event handlers) up front.
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
    // A row's height changes when it expands (the description panel) or when badges wrap to a
    // second line — re-measure the real rendered element rather than trusting the estimate.
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  useEffect(() => {
    // Deferred to the next frame rather than called synchronously in the effect: react-virtual's
    // scrollToIndex can call flushSync internally, and calling that mid-render (e.g. several
    // keydowns firing in quick succession, as with keyboard repeat while holding "j") throws
    // "flushSync was called from inside a lifecycle method" — verified live by dispatching a
    // burst of keydowns. Deferring lets each render commit before the scroll runs.
    const frame = requestAnimationFrame(() => virtualizer.scrollToIndex(focusedIndex, { align: "auto" }));
    return () => cancelAnimationFrame(frame);
    // Re-measuring on expand/collapse alone isn't enough to reposition scroll for a row whose
    // height just changed — re-running scrollToIndex after a layout-affecting state change keeps
    // the focused row in view. items.length covers rows leaving the list via triage actions.
    // `virtualizer` is deliberately omitted — it's a new object identity every render, and is
    // otherwise stable in the ways that matter here (same scroll element, same item count source).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIndex, expandedId, items.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape" && selectedIds.size > 0) {
        event.preventDefault();
        setSelectedIds(new Set());
        return;
      }
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, items.length - 1));
        return;
      }
      if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (event.key === "Enter" || event.key === "o") {
        const job = items[focusedIndex];
        if (job) setExpandedId((id) => (id === job.id ? null : job.id));
        return;
      }

      const status = SHORTCUT_TO_STATUS[event.key.toLowerCase()];
      if (status) {
        const job = items[focusedIndex];
        if (job) act(job.id, status);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items, focusedIndex, act, selectedIds.size]);

  const selectionLabel = useMemo(() => {
    if (selectedIds.size === 0) return null;
    return `${selectedIds.size} selected`;
  }, [selectedIds.size]);

  if (items.length === 0) {
    return <EmptyState icon={InboxIcon} title="All caught up" description={emptyLabel} />;
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-3 px-1">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = selectedIds.size > 0 && !allSelected;
            }}
            onChange={toggleSelectAll}
            aria-label="Select all"
            className="h-4 w-4 rounded border-input"
          />
          Select all
        </label>

        {selectionLabel ? (
          <div role="toolbar" aria-label="Bulk actions" className="flex flex-1 flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{selectionLabel}</span>
            {BULK_ACTIONS.map(({ status, label }) => (
              <button
                key={status}
                type="button"
                onClick={() => bulkAct(status)}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const job = items[virtualRow.index];
            if (!job) return null;
            return (
              <div
                key={job.id}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute top-0 left-0 w-full pb-2"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <InboxRow
                  job={job}
                  focused={virtualRow.index === focusedIndex}
                  expanded={expandedId === job.id}
                  selected={selectedIds.has(job.id)}
                  onFocus={() => setFocusedIndex(virtualRow.index)}
                  onToggleExpand={() => setExpandedId((id) => (id === job.id ? null : job.id))}
                  onToggleSelect={() => toggleSelect(job.id)}
                  onAct={(status) => act(job.id, status)}
                  onDismissDuplicate={() => dismissDuplicate(job.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
