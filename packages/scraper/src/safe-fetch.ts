import dns from "node:dns/promises";
import net from "node:net";

const USER_AGENT =
  "CareerCommandCenterBot/0.1 (+personal job-search tracker; single-user, respects robots.txt)";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const DEFAULT_MIN_HOST_INTERVAL_MS = 1000;
const MAX_MIN_HOST_INTERVAL_MS = 30_000; // cap even an extreme Crawl-delay so one host can't stall a run

const lastFetchByHost = new Map<string, number>();
const minIntervalByHost = new Map<string, number>();

/**
 * Lets robots.txt's Crawl-delay (parsed separately in robots.ts) override the default
 * per-host spacing — some sites explicitly ask for slower crawling, and we should honor that
 * rather than always using our own default.
 */
export function setMinHostInterval(hostname: string, ms: number): void {
  minIntervalByHost.set(hostname, Math.min(Math.max(ms, DEFAULT_MIN_HOST_INTERVAL_MS), MAX_MIN_HOST_INTERVAL_MS));
}

export class SsrfBlockedError extends Error {
  constructor(hostname: string) {
    super(`Refusing to fetch "${hostname}": it resolves to a private/internal address`);
    this.name = "SsrfBlockedError";
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

/** Expands "a::b" shorthand to the full 8-group form so a mapped-IPv4 suffix can be read
 * positionally — Node's URL parser normalizes an embedded IPv4 (e.g. "::ffff:127.0.0.1") into
 * two hex groups ("::ffff:7f00:1"), so the address reaching this function may already be in
 * either form. */
function expandIPv6Groups(ip: string): string[] {
  const [head, tail] = ip.includes("::") ? ip.split("::") : [ip, undefined];
  const headGroups = head ? head.split(":").filter(Boolean) : [];
  const tailGroups = tail ? tail.split(":").filter(Boolean) : [];
  const missing = 8 - headGroups.length - tailGroups.length;
  return [...headGroups, ...Array(Math.max(missing, 0)).fill("0"), ...tailGroups];
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local, fc00::/7
  if (/^fe[89ab]/.test(lower)) return true; // link-local, fe80::/10

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — check both the dotted-decimal form and the two-hex-group
  // form the URL parser normalizes it to.
  if (lower.startsWith("::ffff:")) {
    const embedded = lower.slice("::ffff:".length);
    if (net.isIPv4(embedded)) return isPrivateIPv4(embedded);
  }
  const groups = expandIPv6Groups(lower);
  if (groups.length === 8 && groups.slice(0, 5).every((g) => g === "0") && groups[5] === "ffff") {
    const high = Number.parseInt(groups[6], 16);
    const low = Number.parseInt(groups[7], 16);
    if (Number.isFinite(high) && Number.isFinite(low)) {
      const embedded = [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join(".");
      return isPrivateIPv4(embedded);
    }
  }

  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  // URL.hostname keeps the brackets around an IPv6 literal (e.g. "[::1]"), but net.isIP()
  // only recognizes the bare address — left unstripped, every IPv6-literal host falls through
  // to the dns.lookup() branch below, which just throws ENOTFOUND on the bracketed string
  // instead of ever reaching the intended isPrivateIPv6 check.
  const bareHost = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(bareHost)) {
    const blocked = net.isIPv4(bareHost) ? isPrivateIPv4(bareHost) : isPrivateIPv6(bareHost);
    if (blocked) throw new SsrfBlockedError(hostname);
    return;
  }

  const results = await dns.lookup(hostname, { all: true });
  if (results.length === 0) throw new Error(`Could not resolve host: ${hostname}`);
  for (const { address, family } of results) {
    const blocked = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
    if (blocked) throw new SsrfBlockedError(hostname);
  }
}

function waitForHostSlot(hostname: string): Promise<void> {
  const minInterval = minIntervalByHost.get(hostname) ?? DEFAULT_MIN_HOST_INTERVAL_MS;
  const last = lastFetchByHost.get(hostname) ?? 0;
  const wait = Math.max(0, last + minInterval - Date.now());
  lastFetchByHost.set(hostname, Date.now() + wait);
  return wait > 0 ? new Promise((resolve) => setTimeout(resolve, wait)) : Promise.resolve();
}

/**
 * A fetch wrapper for user-supplied URLs (career page sources, job-link imports): validates
 * scheme, blocks requests that resolve to private/internal addresses (including through
 * redirects), applies a timeout, caps response size, and enforces minimum per-host spacing.
 */
export async function safeFetch(
  inputUrl: string,
  init: RequestInit = {},
  redirectsLeft = MAX_REDIRECTS,
): Promise<Response> {
  const url = new URL(inputUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Refusing to fetch non-http(s) URL: ${inputUrl}`);
  }

  await assertPublicHost(url.hostname);
  await waitForHostSlot(url.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json, text/html;q=0.8, */*;q=0.5",
        ...init.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) throw new Error(`Redirect with no Location header from ${inputUrl}`);
    if (redirectsLeft <= 0) throw new Error(`Too many redirects starting at ${inputUrl}`);
    return safeFetch(new URL(location, url).toString(), init, redirectsLeft - 1);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new Error(`Response from ${inputUrl} exceeds the ${MAX_RESPONSE_BYTES}-byte size limit`);
  }

  return response;
}

export async function safeFetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await safeFetch(url, init);
  if (!response.ok) {
    throw new Error(`${url} responded with ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error(`Response from ${url} exceeded the size limit while streaming`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf-8");
}

export async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const text = await safeFetchText(url, init);
  return JSON.parse(text) as T;
}
