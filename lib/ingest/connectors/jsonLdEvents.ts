import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { fetchText } from "./feedFetch";
import { localizeDenver } from "./localize";

// Generic connector for pages that embed schema.org event data as JSON-LD
// (<script type="application/ld+json"> blocks of @type "...Event" / "Festival").
// Many venue platforms emit this — e.g. The Junkyard's Live Nation listing — with
// clean name/startDate (tz-aware)/image/url/location. Configure with
// `connector: "jsonLdEvents"` and `url` = the listing page; pin single-venue
// pages via defaultVenueSlug. Distinct from cheerioWeb, which scrapes rendered
// card markup with per-site selectors.

interface LdEvent {
  "@type"?: string | string[];
  name?: string;
  startDate?: string;
  url?: string;
  image?: string | string[];
  description?: string;
  location?: {
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
    };
  };
}

function isEvent(type: LdEvent["@type"]): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === "string" && (t.includes("Event") || t === "Festival"));
}

// JSON-LD blocks can be a single object, an array, or an @graph wrapper.
function flattenLd(parsed: unknown): LdEvent[] {
  if (Array.isArray(parsed)) return parsed.flatMap(flattenLd);
  if (parsed && typeof parsed === "object") {
    const obj = parsed as { "@graph"?: unknown };
    if (obj["@graph"]) return flattenLd(obj["@graph"]);
    return [parsed as LdEvent];
  }
  return [];
}

function formatAddress(loc: LdEvent["location"]): string | undefined {
  const a = loc?.address;
  if (!a) return undefined;
  return [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode]
    .filter(Boolean)
    .join(", ");
}

export async function fetchJsonLdEvents(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url || Array.isArray(source.url)) {
    throw new Error(`source ${source.id} needs a single page url`);
  }
  const pageUrl = source.url;

  const html = await fetchText(pageUrl);
  const $ = cheerio.load(html);
  const events: LdEvent[] = [];
  $('script[type="application/ld+json"]').each((_i, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    try {
      flattenLd(JSON.parse(raw)).forEach((e) => {
        if (isEvent(e["@type"]) && e.name?.trim()) events.push(e);
      });
    } catch {
      // Skip malformed JSON-LD blocks rather than failing the run.
    }
  });

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const e of events) {
    const name = e.name!.trim();
    // startDate is a tz-aware ISO instant; render Denver-local so the normalizer
    // extracts the right calendar day + showtime.
    const dateStr = e.startDate ? localizeDenver(e.startDate) : null;
    const sourceId =
      e.url ?? createHash("sha1").update(`${name}@${e.startDate ?? ""}`).digest("hex").slice(0, 16);
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const address = formatAddress(e.location);
    const text = [
      name,
      dateStr && `Date: ${dateStr}`,
      e.location?.name && `Venue: ${e.location.name}`,
      address && `Address: ${address}`,
      e.description?.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const image = Array.isArray(e.image) ? e.image[0] : e.image;
    out.push({
      sourceId,
      sourceUrl: e.url || pageUrl,
      text,
      imageUrl: image || undefined,
      fetchedAt,
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
