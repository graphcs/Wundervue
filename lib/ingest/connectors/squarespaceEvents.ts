import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { htmlToText } from "./htmlText";

// Generic Squarespace Events connector. Squarespace exposes any event collection
// as clean JSON at `<collection-url>?format=json`, with an `upcoming` array of
// items carrying structured startDate/endDate (epoch ms), title, excerpt/body,
// fullUrl, assetUrl (image) and a location. So we hit that instead of scraping
// the JS-rendered page. Configure with `connector: "squarespaceEvents"`, `url`
// (the events collection URL, e.g. https://www.larimersquare.com/events),
// `defaultVenueName`, and `defaultVenueSlug`.

interface SqsLocation {
  addressTitle?: string;
  addressLine1?: string;
  addressLine2?: string;
}

// HTML entities (e.g. "D&#39;art Gallery") show up in titles/location names.
interface SqsItem {
  id?: string;
  title?: string;
  startDate?: number;
  endDate?: number;
  fullUrl?: string;
  assetUrl?: string;
  excerpt?: string;
  body?: string;
  location?: SqsLocation;
}
interface SqsResponse {
  upcoming?: SqsItem[];
  items?: SqsItem[];
}

function denver(ms: number, opts: Intl.DateTimeFormatOptions): string {
  return new Date(ms).toLocaleString("en-US", { timeZone: "America/Denver", ...opts });
}

// A real street address from the item's location, if Squarespace has one (the
// feed often returns its empty default, which we ignore).
function addressOf(loc: SqsLocation | undefined): string | null {
  const parts = [loc?.addressLine1, loc?.addressLine2].map((p) => p?.trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export async function fetchSquarespaceEvents(source: SourceConfig): Promise<RawItem[]> {
  const base = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!base) throw new Error(`source ${source.id} missing url`);
  const url = `${base}${base.includes("?") ? "&" : "?"}format=json`;

  const json = await withRetry(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`squarespace fetch failed: status ${res.status}`);
    return (await res.json()) as SqsResponse;
  });

  // List-mode collections pre-filter into `upcoming`; calendar-mode ones (e.g.
  // New Terrain) leave it empty and put the month's events in `items` (past +
  // future), so fall back to those, keeping only upcoming, soonest first.
  const now = Date.now();
  const upcoming = json.upcoming ?? [];
  const items = upcoming.length
    ? upcoming
    : (json.items ?? [])
        .filter((e) => e.startDate && e.startDate >= now)
        .sort((a, b) => (a.startDate ?? 0) - (b.startDate ?? 0));
  const fetchedAt = new Date().toISOString();
  const out: RawItem[] = [];

  for (const e of items) {
    const title = (e.title ?? "").trim();
    if (!title || !e.startDate) continue;

    const dateDisplay = denver(e.startDate, { month: "long", day: "numeric", year: "numeric" });
    const startTime = denver(e.startDate, { hour: "numeric", minute: "2-digit" });
    const endTime = e.endDate ? denver(e.endDate, { hour: "numeric", minute: "2-digit" }) : null;
    const timeDisplay = endTime ? `${startTime} – ${endTime}` : startTime;

    const description = htmlToText(e.excerpt) || htmlToText(e.body);
    const address = addressOf(e.location);
    // Pin to the configured venue when set; otherwise use the per-event location
    // name (multi-venue collections like the Art District's galleries).
    const venueName = source.defaultVenueName ?? (htmlToText(e.location?.addressTitle) || null);

    const blob = [
      title,
      `Date: ${dateDisplay}`,
      `Time: ${timeDisplay}`,
      description,
      venueName ? `Venue: ${venueName}${address ? `, ${address}` : ""}` : address ? `Address: ${address}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    out.push({
      sourceId: `${source.id}:${e.id ?? e.fullUrl ?? title}`,
      sourceUrl: e.fullUrl ? new URL(e.fullUrl, base).href : undefined,
      text: blob,
      imageUrl: e.assetUrl || undefined,
      fetchedAt,
      venueName: venueName ?? undefined,
      address: address ?? undefined,
    });
  }

  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
