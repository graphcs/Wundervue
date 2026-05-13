import { createHash } from "node:crypto";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Many event sites embed schema.org Event data as JSON-LD on their listing
// pages (Ticketmaster, Eventbrite, AXS, Dice, etc.). This connector fetches
// the page, finds every <script type="application/ld+json"> block, walks the
// parsed JSON looking for Event-shaped objects, and converts each into a
// RawItem. Far more stable than scraping the surrounding DOM, which is often
// dynamically rendered and class-mangled.

interface SchemaEvent {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  image?: string | Array<string | { url?: string }> | { url?: string };
  location?: SchemaPlace | SchemaPlace[];
  offers?: SchemaOffer | SchemaOffer[];
}

interface SchemaPlace {
  "@type"?: string;
  name?: string;
  address?: SchemaAddress | string;
}

interface SchemaAddress {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
}

interface SchemaOffer {
  price?: string | number;
  priceCurrency?: string;
  url?: string;
}

const EVENT_TYPES = new Set([
  "Event",
  "MusicEvent",
  "TheaterEvent",
  "ComedyEvent",
  "SportsEvent",
  "BusinessEvent",
  "ChildrensEvent",
  "DanceEvent",
  "EducationEvent",
  "ExhibitionEvent",
  "Festival",
  "FoodEvent",
  "LiteraryEvent",
  "ScreeningEvent",
  "SocialEvent",
  "VisualArtsEvent",
]);

function isEvent(obj: unknown): obj is SchemaEvent {
  if (!obj || typeof obj !== "object") return false;
  const t = (obj as { "@type"?: unknown })["@type"];
  if (typeof t === "string") return EVENT_TYPES.has(t);
  if (Array.isArray(t)) return t.some((x) => typeof x === "string" && EVENT_TYPES.has(x));
  return false;
}

// Recursively walks the parsed JSON-LD tree and collects every Event-typed
// node. Eventbrite nests events inside ItemList.itemListElement[].item;
// Ticketmaster returns them as a flat array. Walking handles both shapes
// (and @graph) without per-site code.
function collectEvents(node: unknown, out: SchemaEvent[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectEvents(item, out);
    return;
  }
  if (typeof node !== "object") return;
  if (isEvent(node)) out.push(node as SchemaEvent);
  for (const v of Object.values(node as Record<string, unknown>)) {
    collectEvents(v, out);
  }
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Some sites embed slightly malformed JSON or HTML-escaped strings;
      // skip silently — other blocks on the page may still parse.
    }
  }
  return blocks;
}

function firstImage(img: SchemaEvent["image"]): string | undefined {
  if (!img) return undefined;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) {
    for (const i of img) {
      if (typeof i === "string") return i;
      if (i && typeof i === "object" && typeof i.url === "string") return i.url;
    }
    return undefined;
  }
  if (typeof img === "object" && typeof img.url === "string") return img.url;
  return undefined;
}

function firstLocation(loc: SchemaEvent["location"]): SchemaPlace | undefined {
  if (!loc) return undefined;
  return Array.isArray(loc) ? loc[0] : loc;
}

function formatAddress(addr: SchemaAddress | string | undefined): string | undefined {
  if (!addr) return undefined;
  if (typeof addr === "string") return addr;
  const parts = [
    addr.streetAddress,
    addr.addressLocality,
    addr.addressRegion,
    addr.postalCode,
  ].filter((x): x is string => Boolean(x));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function priceFromOffers(offers: SchemaEvent["offers"]): string | undefined {
  if (!offers) return undefined;
  const first = Array.isArray(offers) ? offers[0] : offers;
  if (!first?.price && first?.price !== 0) return undefined;
  const n = Number(first.price);
  if (Number.isFinite(n) && n === 0) return "Free";
  if (Number.isFinite(n)) return `From $${n}`;
  return undefined;
}

function eventToText(ev: SchemaEvent, place: SchemaPlace | undefined, address: string | undefined): string {
  const parts: string[] = [];
  if (ev.name) parts.push(`Title: ${ev.name}`);
  if (place?.name) parts.push(`Venue: ${place.name}`);
  if (address) parts.push(`Address: ${address}`);
  if (ev.startDate) {
    const when = ev.endDate && ev.endDate !== ev.startDate
      ? `${ev.startDate} – ${ev.endDate}`
      : ev.startDate;
    parts.push(`When: ${when}`);
  }
  const price = priceFromOffers(ev.offers);
  if (price) parts.push(`Price: ${price}`);
  if (ev.description) parts.push(`Description: ${ev.description}`);
  return parts.join("\n");
}

export async function fetchJsonLdEvents(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url) {
    throw new Error(`source ${source.id} missing url`);
  }
  const url = source.url;

  const html = await withRetry(async () => {
    const res = await fetch(url, {
      headers: {
        // Both Ticketmaster and Eventbrite serve a stripped-down anti-bot
        // page to obvious crawler UAs. A real-looking browser UA gets full
        // server-rendered HTML (including the JSON-LD event blocks).
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      throw new Error(`fetch ${url} failed: status ${res.status}`);
    }
    return res.text();
  });

  const fetchedAt = new Date().toISOString();
  const blocks = extractJsonLdBlocks(html);
  const events: SchemaEvent[] = [];
  for (const b of blocks) collectEvents(b, events);

  const items: RawItem[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (!ev.name) continue;
    const place = firstLocation(ev.location);
    const address = formatAddress(place?.address);
    const sourceUrl = ev.url ? new URL(ev.url, url).toString() : url;

    // Prefer the canonical event URL as the dedup key; fall back to a hash
    // when missing (some upstream sources omit url for sub-events).
    const key = ev.url
      ? sourceUrl
      : createHash("sha1")
          .update(`${ev.name}|${ev.startDate ?? ""}|${place?.name ?? ""}`)
          .digest("hex")
          .slice(0, 16);
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      sourceId: `${source.id}:${key}`,
      sourceUrl,
      text: eventToText(ev, place, address),
      imageUrl: firstImage(ev.image),
      fetchedAt,
      venueName: place?.name,
      address,
    });
  }

  return items;
}
