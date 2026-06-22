import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Squarespace *products* collection where classes/workshops are sold as commerce
// items with a date picker (e.g. City Mud's pottery "give it a try nights", with
// variant dates "July 3rd", "July 17th"). The events live in product variant
// attributes, not an events calendar — so the squarespaceEvents connector can't
// read them. We pull /<collection>?format=json and emit one listing per dated
// variant; products with no dated variant (merch) are skipped. Point `url` at the
// products collection and set defaultVenueName. Reusable for any class/studio
// venue on Squarespace commerce.

interface SqVariant {
  attributes?: Record<string, string>;
  optionValues?: Array<{ optionName?: string; value?: string }>;
  priceMoney?: { value?: string };
}
interface SqProduct {
  title?: string;
  fullUrl?: string;
  excerpt?: string;
  body?: string;
  assetUrl?: string;
  variants?: SqVariant[];
}
interface SqFeed {
  items?: SqProduct[];
}

// Matches a date-ish variant value ("July 3rd", "Dec 5", "12/14").
const DATEISH =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2}\b|\b\d{1,2}\s*(st|nd|rd|th)\b|\b\d{1,2}\/\d{1,2}\b/i;

function stripHtml(s: string | undefined): string {
  return (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// A variant's date label — an explicit `date` attribute, else any attribute or
// option value that looks like a date.
function variantDate(v: SqVariant): string | null {
  const attrs = v.attributes ?? {};
  if (attrs.date) return attrs.date;
  for (const val of Object.values(attrs)) if (DATEISH.test(val)) return val;
  for (const o of v.optionValues ?? []) if (o.value && DATEISH.test(o.value)) return o.value;
  return null;
}

export async function fetchSquarespaceProducts(source: SourceConfig): Promise<RawItem[]> {
  const base = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!base) throw new Error(`source ${source.id} missing url (Squarespace products collection)`);
  const origin = new URL(base).origin;
  const feedUrl = base.includes("?") ? base : `${base}?format=json`;

  const feed = await withRetry(async () => {
    const res = await fetch(feedUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`squarespace products ${res.status}`);
    return (await res.json()) as SqFeed;
  });

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const p of feed.items ?? []) {
    const title = (p.title ?? "").trim();
    if (!title) continue;
    const dated = (p.variants ?? [])
      .map((v) => ({ date: variantDate(v), price: v.priceMoney?.value }))
      .filter((x): x is { date: string; price: string | undefined } => Boolean(x.date));
    if (dated.length === 0) continue; // not a dated class — skip merch

    const excerpt = stripHtml(p.excerpt || p.body).slice(0, 300);
    const link = p.fullUrl ? origin + p.fullUrl : base;
    const img = p.assetUrl
      ? p.assetUrl.includes("?")
        ? p.assetUrl
        : `${p.assetUrl}?format=1500w`
      : undefined;
    const slug = (p.fullUrl || title).replace(/\/+$/, "").split("/").pop() || "item";

    for (const { date, price } of dated) {
      const sourceId = `${source.id}:${slug}-${date.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);
      const text = [
        title,
        `Date: ${date}`,
        source.defaultVenueName ? `Venue: ${source.defaultVenueName}` : "",
        price ? `Price: $${price}` : "",
        excerpt,
      ]
        .filter(Boolean)
        .join("\n");
      out.push({ sourceId, sourceUrl: link, text, imageUrl: img, fetchedAt, venueName: source.defaultVenueName });
    }
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
