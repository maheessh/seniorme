import robotsParser from "robots-parser";
import { safeFetchText } from "./safe-fetch";

type Robot = ReturnType<typeof robotsParser>;

const USER_AGENT = "CareerCommandCenterBot";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const cache = new Map<string, { robot: Robot | null; fetchedAt: number }>();

async function getRobots(origin: string): Promise<Robot | null> {
  const cached = cache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.robot;
  }

  let robot: Robot | null;
  try {
    const robotsUrl = new URL("/robots.txt", origin).toString();
    const text = await safeFetchText(robotsUrl);
    robot = robotsParser(robotsUrl, text);
  } catch {
    // No robots.txt, or it's unreachable — treat as "no restrictions" per common convention.
    robot = null;
  }

  cache.set(origin, { robot, fetchedAt: Date.now() });
  return robot;
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  const parsed = new URL(url);
  const robot = await getRobots(parsed.origin);
  if (!robot) return true;
  const allowed = robot.isAllowed(url, USER_AGENT);
  return allowed ?? true;
}
