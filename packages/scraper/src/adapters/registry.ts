import type { CareerSiteAdapter } from "../types";
import { ashbyAdapter } from "./ashby";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";

// Ordered adapter registry — first match wins. New adapters (SmartRecruiters, Workday,
// generic JSON-LD, ...) register here without touching the scheduler/worker.
const ADAPTERS: CareerSiteAdapter[] = [greenhouseAdapter, leverAdapter, ashbyAdapter];

export function resolveAdapter(sourceUrl: string): CareerSiteAdapter | null {
  const url = new URL(sourceUrl);
  return ADAPTERS.find((adapter) => adapter.matches(url)) ?? null;
}
