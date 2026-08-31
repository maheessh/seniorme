"use client";

import type { InboxStatus } from "@ccc/db";
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

export function InboxList({ jobs, emptyLabel }: { jobs: InboxJob[]; emptyLabel: string }) {
  const [items, setItems] = useState(jobs);
  const [rawFocusedIndex, setFocusedIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
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

  useEffect(() => {
    rowRefs.current[focusedIndex]?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

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
    <div className="flex flex-col gap-2">
      {items.map((job, index) => (
        <InboxRow
          key={job.id}
          ref={(el) => {
            rowRefs.current[index] = el;
          }}
          job={job}
          focused={index === focusedIndex}
          expanded={expandedId === job.id}
          onFocus={() => setFocusedIndex(index)}
          onToggleExpand={() => setExpandedId((id) => (id === job.id ? null : job.id))}
          onAct={(status) => act(job.id, status)}
          onDismissDuplicate={() => dismissDuplicate(job.id)}
        />
      ))}
    </div>
  );
}
