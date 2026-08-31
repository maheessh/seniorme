export type OpenGraphData = {
  title?: string;
  description?: string;
  siteName?: string;
  image?: string;
  url?: string;
};

const META_TAG_RE = /<meta\s+[^>]*>/gi;
const PROPERTY_RE = /(?:property|name)=["']([^"']+)["']/i;
const CONTENT_RE = /content=["']([^"']*)["']/i;

const PROPERTY_MAP: Record<string, keyof OpenGraphData> = {
  "og:title": "title",
  "og:description": "description",
  "og:site_name": "siteName",
  "og:image": "image",
  "og:url": "url",
};

export function extractOpenGraph(html: string): OpenGraphData {
  const result: OpenGraphData = {};

  for (const tagMatch of html.matchAll(META_TAG_RE)) {
    const tag = tagMatch[0];
    const property = tag.match(PROPERTY_RE)?.[1];
    if (!property) continue;
    const field = PROPERTY_MAP[property.toLowerCase()];
    if (!field || result[field]) continue;
    const content = tag.match(CONTENT_RE)?.[1];
    if (content) result[field] = decodeHtmlEntities(content);
  }

  if (!result.title) {
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    if (titleMatch) result.title = decodeHtmlEntities(titleMatch[1].trim());
  }

  return result;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
