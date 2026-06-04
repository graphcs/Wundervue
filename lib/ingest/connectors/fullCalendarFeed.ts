import { createHash } from "node:crypto";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Generic connector for sites whose calendar is a jQuery FullCalendar widget
// backed by a JSON events feed (e.g. Ball Arena -> alttix.ksehq.com). FullCalendar
// requests its feed with `start`/`end` date params, so we append a forward window.
// The feed returns a flat array of { title, start, end?, url?, ... }. Configure
// with `connector: "fullCalendarFeed"` and `url` = the feed endpoint.
const WINDOW_DAYS = 180;

interface FeedEvent {
  title?: string;
  start?: string;
  end?: string | null;
  url?: string;
  description?: string;
  imageUrl?: string;
  image?: string;
  imageurl?: string;
}

function feedImage(e: FeedEvent): string | undefined {
  return e.imageUrl || e.image || e.imageurl || undefined;
}

export async function fetchFullCalendarFeed(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url || Array.isArray(source.url)) {
    throw new Error(`source ${source.id} needs a single feed url`);
  }
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const sep = source.url.includes("?") ? "&" : "?";
  const feedUrl = `${source.url}${sep}start=${start}&end=${end}`;

  const events = await withRetry(async () => {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`feed fetch failed: status ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error(`feed did not return an array`);
    return json as FeedEvent[];
  });

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const e of events) {
    if (!e.title?.trim() || !e.start) continue;
    // Stable id from the event URL when present, else title+start.
    const key = e.url ?? `${e.title}@${e.start}`;
    const sourceId = createHash("sha1").update(key).digest("hex").slice(0, 16);
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    // `start` is a venue-local datetime ("2026-11-14T11:00:00", no zone), so
    // pass it through verbatim — unambiguous for date extraction, no tz shift.
    const text = [e.title.trim(), `Date: ${e.start}`, e.description?.trim()]
      .filter(Boolean)
      .join("\n");
    out.push({
      sourceId,
      sourceUrl: e.url || undefined,
      text,
      imageUrl: feedImage(e),
      fetchedAt,
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
