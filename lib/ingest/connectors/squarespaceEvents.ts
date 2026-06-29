import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { htmlToText } from "./htmlText";
import { isTicketingUrl } from "@/lib/tickets";

// First link in an HTML blob that points at a known ticketing domain (e.g. an
// Eventbrite/SimpleTix link embedded in the event body) → the "Buy Tickets" CTA.
// Parse with cheerio rather than a raw regex so hrefs are entity-decoded — a
// raw `href="…?a=1&amp;b=2"` would otherwise be stored with a literal `&amp;`
// and corrupt the affiliate/UTM query params on the live ticket link.
function firstTicketingHref(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const $ = cheerio.load(html);
  for (const el of $("a[href]").toArray()) {
    const href = $(el).attr("href");
    if (isTicketingUrl(href)) return href;
  }
  return undefined;
}

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
  const origin = base.split("?")[0];
  const fetchJson = (u: string): Promise<SqsResponse> =>
    withRetry(async () => {
      const res = await fetch(u, {
        headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
      });
      if (!res.ok) throw new Error(`squarespace fetch failed: status ${res.status}`);
      return (await res.json()) as SqsResponse;
    });

  const json = await fetchJson(`${origin}?format=json`);

  // List-mode collections pre-filter into `upcoming`. Calendar-mode ones (e.g.
  // New Terrain, Bread Bar) leave it empty and return only the CURRENT month's
  // events in `items` — so also fetch the next few months via &month=MM-YYYY,
  // merge, keep only upcoming, dedupe, soonest first. Without this, events past
  // the current month are missed until the calendar rolls into their month.
  const now = Date.now();
  const upcoming = json.upcoming ?? [];
  let items: SqsItem[];
  if (upcoming.length) {
    items = upcoming;
  } else {
    const MONTHS_AHEAD = 3;
    const d = new Date();
    const monthResponses = await Promise.all(
      Array.from({ length: MONTHS_AHEAD }, (_, i) => {
        const m = new Date(d.getFullYear(), d.getMonth() + i + 1, 1);
        const mp = `${String(m.getMonth() + 1).padStart(2, "0")}-${m.getFullYear()}`;
        return fetchJson(`${origin}?view=calendar&month=${mp}&format=json`).catch(() => ({}) as SqsResponse);
      }),
    );
    const byId = new Map<string, SqsItem>();
    for (const r of [json, ...monthResponses]) {
      for (const e of r.items ?? []) {
        if (e.startDate && e.startDate >= now) byId.set(e.id ?? e.fullUrl ?? String(e.startDate), e);
      }
    }
    items = [...byId.values()].sort((a, b) => (a.startDate ?? 0) - (b.startDate ?? 0));
  }
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
      ticketUrl: firstTicketingHref(e.body) ?? firstTicketingHref(e.excerpt),
      text: blob,
      imageUrl: e.assetUrl || undefined,
      fetchedAt,
      venueName: venueName ?? undefined,
      address: address ?? undefined,
    });
  }

  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
