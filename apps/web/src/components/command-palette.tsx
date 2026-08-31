"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(
    () => NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  // Reset search state at render time whenever the palette opens or the query changes — a stale
  // filter/selection from the last time it was open, or from before the latest keystroke, would
  // be surprising. Render-time comparison rather than a setState-in-effect (see set-state-in-effect
  // lint rule): each `handled*` ref tracks the value this render already accounted for.
  const [handledOpen, setHandledOpen] = useState(open);
  if (open !== handledOpen) {
    setHandledOpen(open);
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }
  const [handledQuery, setHandledQuery] = useState(query);
  if (query !== handledQuery) {
    setHandledQuery(query);
    setActiveIndex(0);
  }

  // Global Cmd+K / Ctrl+K opens the palette from anywhere in the app, matching the standard
  // convention (Linear, Notion, Slack, ...) — the whole point of a command palette is that it
  // doesn't require first navigating to find it.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Radix moves focus into the content on open; queue this just after so it isn't clobbered.
  // Pure DOM focus, not a setState call, so this one is a legitimate effect.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function go(index: number) {
    const item = results[index];
    if (!item) return;
    router.push(item.href);
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Open command palette"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-muted-foreground"
      >
        <Search className="h-4 w-4" />
        <kbd className="hidden rounded border border-border px-1.5 text-xs sm:inline">⌘K</kbd>
      </Button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
          <DialogPrimitive.Content
            onOpenAutoFocus={(event) => event.preventDefault()}
            className="fixed top-[20%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-xl focus:outline-none"
          >
            <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Search and jump to any page in Senior Me.
            </DialogPrimitive.Description>
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((i) => Math.min(i + 1, results.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((i) => Math.max(i - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    go(activeIndex);
                  }
                }}
                placeholder="Jump to a page…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                Esc
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matching page.</p>
              ) : (
                results.map(({ href, label, icon: Icon }, index) => (
                  <button
                    key={href}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(index)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                      index === activeIndex ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
