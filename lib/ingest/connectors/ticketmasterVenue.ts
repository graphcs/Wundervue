import { createHash } from "node:crypto";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { localizeDenver } from "./localize";

// Ticketmaster Discovery API venue feed, as served by KSE's public proxy
// (alttix.ksehq.com/api/tm/venue/<tmVenueId>) — the same client-side feed the
// Paramount Theatre's TMEventWidget.js fetches. Returns a flat array of Discovery
// API event objects (name, dates, images, classifications, ticketmaster url).
// Configure with `connector: "ticketmasterVenue"` and `url` = the feed endpoint.
// The feed is venue-scoped (every event is at the one venue), so pin via
// defaultVenueSlug. Distinct from `fullCalendarFeed`, which reads the sibling
// /api/tm/Calendar?Id= endpoint's flatter FullCalendar shape (Ball Arena).

interface TMImage {
  url?: string;
  width?: number;
  height?: number;
}
interface TMEvent {
  id?: string;
  name?: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  images?: TMImage[];
  dates?: {
    start?: { localDate?: string; dateTime?: string; noSpecificTime?: boolean };
    timezone?: string;
  };
  classifications?: Array<{ segment?: { name?: string }; genre?: { name?: string } }>;
}

// TM serves portrait and landscape crops of the same art; the image pipeline
// rejects portrait (bad aspect ratio), so pick the largest landscape crop.
function bestImage(e: TMEvent): string | undefined {
  const imgs = (e.images ?? []).filter(
    (i) => i.url && (i.width ?? 0) >= (i.height ?? 0) && (i.width ?? 0) >= 600,
  );
  imgs.sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0));
  return imgs[0]?.url;
}

export async function fetchTicketmasterVenue(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url || Array.isArray(source.url)) {
    throw new Error(`source ${source.id} needs a single feed url`);
  }
  const feedUrl = source.url;

  const events = await withRetry(async () => {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`tm feed fetch failed: status ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error(`tm feed did not return an array`);
    return json as TMEvent[];
  });

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const e of events) {
    const name = e.name?.trim();
    const start = e.dates?.start;
    if (!name || !start) continue;
    // start.dateTime is the UTC instant — render it Denver-local so the
    // normalizer extracts the right calendar day + showtime (a 01:30Z start is
    // the prior evening in Denver). start.localDate is the time-unset fallback.
    const dateStr =
      start.dateTime && !start.noSpecificTime
        ? localizeDenver(start.dateTime)
        : start.localDate
          ? start.localDate.slice(0, 10)
          : null;
    if (!dateStr) continue;

    const sourceId =
      e.id ?? createHash("sha1").update(`${name}@${dateStr}`).digest("hex").slice(0, 16);
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const cls = e.classifications?.[0];
    const genre = [cls?.segment?.name, cls?.genre?.name].filter(Boolean).join(" / ");
    const text = [
      name,
      `Date: ${dateStr}`,
      genre && `Category: ${genre}`,
      (e.info || e.pleaseNote || "").trim(),
    ]
      .filter(Boolean)
      .join("\n");

    out.push({
      sourceId,
      sourceUrl: e.url || undefined,
      text,
      imageUrl: bestImage(e),
      fetchedAt,
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
