"use client";

import type { InboxStatus } from "@ccc/db";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Inbox as InboxIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { EmptyState } from "@/components/empty-state";
import type { InboxJob } from "@/lib/server/services/inbox";
import { clearPossibleDuplicateAction, setInboxStatusAction } from "./actions";
import { InboxRow } from "./inbox-row";

const SHORTCUT_TO_STATUS: Record<string, InboxStatus> = {
  s: "SAVED",
  a: "APPLIED",
  g: "IGNORED",
};

// A row's collapsed height (~90px, one company logo + title + badges line) is a reasonable
// estimate for the virtualizer's initial layout pass — actual heights (which vary with badge
// count and, once expanded, the description) are measured per-row via measureElement below.
const ESTIMATED_ROW_HEIGHT = 92;

export function InboxList({ jobs, emptyLabel }: { jobs: InboxJob[]; emptyLabel: string }) {
  const [items, setItems] = useState(jobs);
  const [rawFocusedIndex, setFocusedIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  const act = useCallback((jobId: string, status: InboxStatus) => {
    setItems((prev) => prev.filter((job) => job.id !== jobId));
    startTransition(() => {
      void setInboxStatusAction(jobId, status);
    });
  }, []);

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
  }, [items, focusedIndex, act]);

  if (items.length === 0) {
    return <EmptyState icon={InboxIcon} title="All caught up" description={emptyLabel} />;
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
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
                onFocus={() => setFocusedIndex(virtualRow.index)}
                onToggleExpand={() => setExpandedId((id) => (id === job.id ? null : job.id))}
                onAct={(status) => act(job.id, status)}
                onDismissDuplicate={() => dismissDuplicate(job.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
