"use client";

import { GOAL_STATUS_LABEL, GOAL_STATUSES } from "@ccc/shared";
import { Plus, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { GoalFormDialog } from "./goal-form-dialog";

export function GoalsToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
          placeholder="Search goals…"
          className="pl-9"
        />
      </div>

      <Select
        defaultValue={searchParams.get("status") ?? ""}
        onChange={(event) => setParam("status", event.target.value)}
        className="w-40"
      >
        <option value="">All statuses</option>
        {GOAL_STATUSES.map((status) => (
          <option key={status} value={status}>
            {GOAL_STATUS_LABEL[status]}
          </option>
        ))}
      </Select>

      <GoalFormDialog
        trigger={
          <Button type="button">
            <Plus className="h-4 w-4" /> Add goal
          </Button>
        }
      />
    </div>
  );
}
