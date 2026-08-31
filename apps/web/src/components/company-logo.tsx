"use client";

import { useState } from "react";

export function CompanyLogo({ logoUrl, name, size = 40 }: { logoUrl: string | null; name: string; size?: number }) {
  const [errored, setErrored] = useState(false);

  if (logoUrl && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable domains; not worth Next/Image's static config here
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-lg border border-border bg-white object-contain"
        style={{ width: size, height: size }}
        onError={() => setErrored(true)}
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-medium text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}
