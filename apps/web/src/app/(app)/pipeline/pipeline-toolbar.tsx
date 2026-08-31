"use client";

import { ALL_STAGES, STAGE_LABEL } from "@ccc/shared";
import { Kanban, Search, TableProperties } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function PipelineToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const view = searchParams.get("view") === "table" ? "table" : "kanban";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function onSearchChange(value: string) {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParam("search", value), 250);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-48">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search applications…"
          className="pl-9"
        />
      </div>

      {view === "table" ? (
        <Select
          defaultValue={searchParams.get("stage") ?? ""}
          onChange={(event) => setParam("stage", event.target.value)}
          className="w-44"
        >
          <option value="">All stages</option>
          {ALL_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABEL[stage]}
            </option>
          ))}
        </Select>
      ) : null}

      <div className="flex overflow-hidden rounded-lg border border-border">
        <button
          type="button"
          aria-label="Kanban view"
          onClick={() => setParam("view", "kanban")}
          className={`flex h-10 w-10 items-center justify-center ${view === "kanban" ? "bg-muted" : ""}`}
        >
          <Kanban className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Table view"
          onClick={() => setParam("view", "table")}
          className={`flex h-10 w-10 items-center justify-center border-l border-border ${view === "table" ? "bg-muted" : ""}`}
        >
          <TableProperties className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
