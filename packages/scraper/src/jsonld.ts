export type JsonLdJobPosting = {
  title?: string;
  url?: string;
  descriptionHtml?: string;
  externalJobId?: string;
  postedAt?: string;
  companyName?: string;
  companyDomain?: string;
  companyLogoUrl?: string;
  location?: string;
  employmentType?: string;
  isRemote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
};

const SCRIPT_BLOCK_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function isJobPosting(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const type = (node as Record<string, unknown>)["@type"];
  if (typeof type === "string") return type === "JobPosting";
  if (Array.isArray(type)) return type.includes("JobPosting");
  return false;
}

/** JSON-LD can be a single object, an array, or wrapped in a @graph — search all shapes. */
function findJobPostingNodes(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) return parsed.flatMap(findJobPostingNodes);
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (isJobPosting(obj)) return [obj];
    if (Array.isArray(obj["@graph"])) return findJobPostingNodes(obj["@graph"]);
  }
  return [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(num) ? num : undefined;
}

function formatAddress(address: unknown): string | undefined {
  if (!address || typeof address !== "object") return undefined;
  const a = address as Record<string, unknown>;
  const parts = [asString(a.addressLocality), asString(a.addressRegion), asString(a.addressCountry)];
  const joined = parts.filter(Boolean).join(", ");
  return joined || undefined;
}

function mapJobPostingNode(node: Record<string, unknown>): JsonLdJobPosting {
  const org = node.hiringOrganization as Record<string, unknown> | undefined;
  const location = node.jobLocation as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const firstLocation = Array.isArray(location) ? location[0] : location;
  const address = firstLocation?.address;
  const salary = node.baseSalary as Record<string, unknown> | undefined;
  const salaryValue = salary?.value as Record<string, unknown> | undefined;
  const identifier = node.identifier as Record<string, unknown> | undefined;

  return {
    title: asString(node.title),
    url: asString(node.url),
    descriptionHtml: asString(node.description),
    externalJobId: asString(identifier?.value) ?? asString(node.identifier),
    postedAt: asString(node.datePosted),
    companyName: asString(org?.name),
    companyDomain: (() => {
      const sameAs = asString(org?.sameAs);
      if (!sameAs) return undefined;
      try {
        return new URL(sameAs).hostname.replace(/^www\./, "");
      } catch {
        return undefined;
      }
    })(),
    companyLogoUrl: asString(org?.logo),
    location: formatAddress(address) ?? asString(firstLocation?.name),
    employmentType: asString(node.employmentType),
    isRemote: node.jobLocationType === "TELECOMMUTE" || undefined,
    salaryMin: asNumber(salaryValue?.minValue),
    salaryMax: asNumber(salaryValue?.maxValue),
  };
}

function parseAllScriptBlocks(html: string): Record<string, unknown>[] {
  const blocks = [...html.matchAll(SCRIPT_BLOCK_RE)].map((match) => match[1]);
  const nodes: Record<string, unknown>[] = [];
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue;
    }
    nodes.push(...findJobPostingNodes(parsed));
  }
  return nodes;
}

/** For a single-job page (Phase 5 URL import) — the first JobPosting found, if any. */
export function extractJobPostingJsonLd(html: string): JsonLdJobPosting | null {
  const [node] = parseAllScriptBlocks(html);
  return node ? mapJobPostingNode(node) : null;
}

/**
 * For a career-listing page that embeds every open role's JobPosting JSON-LD directly
 * (common on simpler custom-built career sites, done for Google for Jobs SEO). Postings
 * without a resolvable `url` are dropped — we can't dedupe or link to them.
 */
export function extractAllJobPostingsJsonLd(html: string, baseUrl: string): JsonLdJobPosting[] {
  return parseAllScriptBlocks(html)
    .map(mapJobPostingNode)
    .filter((posting): posting is JsonLdJobPosting & { url: string } => Boolean(posting.title))
    .map((posting) => {
      if (!posting.url) return posting;
      try {
        return { ...posting, url: new URL(posting.url, baseUrl).toString() };
      } catch {
        return { ...posting, url: undefined };
      }
    })
    .filter((posting) => Boolean(posting.url));
}
