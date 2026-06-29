import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// AEG Presents venues (Mission Ballroom, etc.) render their /upcoming-events
// calendar from an AXS widget that fetches a public static JSON feed — no auth,
// no JS. We read the venue page, pull the widget's `data-file` feed URL
// (https://aegwebprod.blob.core.windows.net/json/events/<n>/events.json), and
// map it. Point `url` at the human events page and pin the venue with
// defaultVenueSlug. Reusable for any AEG venue by its events-page URL.

interface AegMedia {
  width?: number;
  height?: number;
  file_name?: string;
}
interface AegEvent {
  eventId?: string;
  title?: {
    eventTitleText?: string;
    headlinersText?: string;
    supportingText?: string | null;
    tour?: string | null;
  };
  eventDateTimeISO?: string;
  bio?: string;
  description?: string;
  venue?: { title?: string };
  media?: Record<string, AegMedia>;
  // AXS ticketing block — `url`/`eventUrl` is the per-event purchase page.
  ticketing?: {
    url?: string;
    eventUrl?: string;
    ticketURL?: string;
    ticketLinkExists?: boolean;
  };
}
interface AegFeed {
  events?: AegEvent[];
}

const FEED_RE = /data-file="([^"]+events\.json)"/;
const UA = { "User-Agent": "Mozilla/5.0" };

function stripHtml(s: string | undefined): string {
  return (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Largest-width media image (AEG ships a 1200x628 variant) — comfortably above
// the image probe's 600x400 floor, so we keep the real artist art.
function bestImage(media: Record<string, AegMedia> | undefined): string | undefined {
  if (!media) return undefined;
  return Object.values(media)
    .filter((m) => m.file_name && (m.width ?? 0) >= 600)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.file_name;
}

export async function fetchAegEvents(source: SourceConfig): Promise<RawItem[]> {
  const pageUrl = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!pageUrl) throw new Error(`source ${source.id} missing url (AEG events page)`);

  const feed = await withRetry(async () => {
    const pageRes = await fetch(pageUrl, { headers: UA });
    if (!pageRes.ok) throw new Error(`aeg page ${pageRes.status}`);
    const m = (await pageRes.text()).match(FEED_RE);
    if (!m) throw new Error(`aeg: events.json feed not found on ${pageUrl}`);
    const feedRes = await fetch(m[1], { headers: UA });
    if (!feedRes.ok) throw new Error(`aeg feed ${feedRes.status}`);
    return (await feedRes.json()) as AegFeed;
  });

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const e of feed.events ?? []) {
    const title = e.title?.eventTitleText || e.title?.headlinersText;
    if (!title || !e.eventId) continue;
    const sourceId = `${source.id}:${e.eventId}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const venueName = e.venue?.title ?? "";
    const text = [
      title,
      e.eventDateTimeISO ? `Date: ${e.eventDateTimeISO}` : "",
      venueName ? `Venue: ${venueName}` : "",
      e.title?.supportingText ? `With: ${e.title.supportingText}` : "",
      e.title?.tour ? `Tour: ${e.title.tour}` : "",
      stripHtml(e.bio || e.description).slice(0, 400),
    ]
      .filter(Boolean)
      .join("\n");

    out.push({
      sourceId,
      sourceUrl: pageUrl,
      // Per-event AXS purchase page → the "Buy Tickets" CTA. The events page
      // (sourceUrl) is a generic venue list, so it stays as the source link.
      ticketUrl: e.ticketing?.url || e.ticketing?.eventUrl || undefined,
      text,
      imageUrl: bestImage(e.media),
      fetchedAt,
      venueName: venueName || undefined,
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
