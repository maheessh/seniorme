import dns from "node:dns/promises";
import net from "node:net";

const USER_AGENT =
  "CareerCommandCenterBot/0.1 (+personal job-search tracker; single-user, respects robots.txt)";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MIN_HOST_INTERVAL_MS = 1000;

const lastFetchByHost = new Map<string, number>();

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

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local, fc00::/7
  if (/^fe[89ab]/.test(lower)) return true; // link-local, fe80::/10
  if (lower.startsWith("::ffff:")) {
    const embedded = lower.slice("::ffff:".length);
    if (net.isIPv4(embedded)) return isPrivateIPv4(embedded);
  }
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    const blocked = net.isIPv4(hostname) ? isPrivateIPv4(hostname) : isPrivateIPv6(hostname);
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
  const last = lastFetchByHost.get(hostname) ?? 0;
  const wait = Math.max(0, last + MIN_HOST_INTERVAL_MS - Date.now());
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
