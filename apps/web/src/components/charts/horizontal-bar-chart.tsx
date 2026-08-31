"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type BarDatum = { label: string; value: number };

export function HorizontalBarChart({
  data,
  unit = "",
  color = "var(--primary)",
}: {
  data: BarDatum[];
  unit?: string;
  color?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Not enough data yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d, i) => (
        <div
          key={d.label}
          className="flex items-center gap-3"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
        >
          <span className="w-28 shrink-0 truncate text-xs text-muted-foreground" title={d.label}>
            {d.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-[width,opacity]")}
              style={{
                width: `${Math.max(2, (d.value / max) * 100)}%`,
                backgroundColor: color,
                opacity: hovered === null || hovered === i ? 1 : 0.45,
              }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-foreground">
            {d.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
