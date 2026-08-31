"use client";

import { LayoutGrid, Plus, Search, TableProperties } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CompanyFormDialog } from "./company-form-dialog";

export function CompaniesToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const view = searchParams.get("view") === "table" ? "table" : "grid";

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
          placeholder="Search companies…"
          className="pl-9"
        />
      </div>

      <Select
        defaultValue={searchParams.get("priority") ?? ""}
        onChange={(event) => setParam("priority", event.target.value)}
        className="w-36"
      >
        <option value="">All priorities</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </Select>

      <div className="flex overflow-hidden rounded-lg border border-border">
        <button
          type="button"
          aria-label="Grid view"
          onClick={() => setParam("view", "grid")}
          className={`flex h-10 w-10 items-center justify-center ${view === "grid" ? "bg-muted" : ""}`}
        >
          <LayoutGrid className="h-4 w-4" />
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

      <CompanyFormDialog
        trigger={
          <Button type="button">
            <Plus className="h-4 w-4" /> Add company
          </Button>
        }
      />
    </div>
  );
}
