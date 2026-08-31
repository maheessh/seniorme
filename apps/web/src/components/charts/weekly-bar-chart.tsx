"use client";

import { useState } from "react";

type BarDatum = { label: string; value: number };

export function WeeklyBarChart({ data, color = "var(--primary)" }: { data: BarDatum[]; color?: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-32 gap-1.5">
        {data.map((d, i) => (
          <div
            key={`${d.label}-${i}`}
            className="relative flex-1"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
          >
            {hovered === i ? (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-background">
                {d.value}
              </div>
            ) : null}
            <div
              className="absolute bottom-0 w-full rounded-t-sm transition-[height,opacity]"
              style={{
                height: `${Math.max(2, (d.value / max) * 100)}%`,
                backgroundColor: color,
                opacity: hovered === null || hovered === i ? 1 : 0.45,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {data.map((d, i) => (
          <span
            key={`${d.label}-${i}`}
            className="flex-1 truncate text-center text-[10px] text-muted-foreground"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
