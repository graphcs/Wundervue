import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Generic connector for RSS event feeds that use the "ev:" (mod_event) namespace
// — title/link/description plus ev:startdate, ev:enddate, ev:location, ev:type.
// Denver Arts & Venues (artsandvenuesdenver.com/events/rss) publishes one with
// 350+ events across its venues (Red Rocks, Buell, Bellco, McNichols…). Dates
// are ISO UTC, so they're localized to Denver before display (a 7pm show reads
// as "T01:00:00Z" the next day). No image in the feed — the image pipeline pulls
// og:image from each event's detail page. Configure with `connector:
// "eventRssFeed"` and `url` (the RSS feed).

function tag(item: string, name: string): string {
  const n = name.replace(":", "\\:");
  const m = item.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)<\\/${n}>`, "i"));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
}

// RSS descriptions are entity-encoded HTML ("&lt;p&gt;…"), so decode once to
// reveal the tags, then strip them on a second pass. Harmless for plain fields.
function htmlToText(html: string): string {
  if (!html) return "";
  const decoded = cheerio.load(`<div>${html}</div>`).text();
  return cheerio.load(`<div>${decoded}</div>`).text().replace(/\s+/g, " ").trim();
}

interface DenverDate {
  isoDate: string; // YYYY-MM-DD in America/Denver
  date: string; // "June 9, 2026"
  time: string; // "7:00 PM"
  instant: number; // ms since epoch (UTC)
}
function denverDate(iso: string): DenverDate | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const tz = { timeZone: "America/Denver" } as const;
  return {
    isoDate: d.toLocaleDateString("en-CA", tz),
    date: d.toLocaleDateString("en-US", { ...tz, month: "long", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { ...tz, hour: "numeric", minute: "2-digit" }),
    instant: d.getTime(),
  };
}

export async function fetchEventRssFeed(source: SourceConfig): Promise<RawItem[]> {
  const url = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!url) throw new Error(`source ${source.id} missing url`);

  const xml = await withRetry(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`fetch ${url} failed: status ${res.status}`);
    return res.text();
  });

  const fetchedAt = new Date().toISOString();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const cutoff = todayStart.getTime();

  const out: Array<RawItem & { _sort: number }> = [];
  const seen = new Set<string>();

  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item = m[1];
    const title = htmlToText(tag(item, "title"));
    const start = denverDate(tag(item, "ev:startdate") || tag(item, "dc:date"));
    if (!title || !start) continue;

    const end = tag(item, "ev:enddate") ? denverDate(tag(item, "ev:enddate")) : null;
    // Upcoming = hasn't fully ended yet (keeps multi-day events showing).
    if ((end?.instant ?? start.instant) < cutoff) continue;

    const link = tag(item, "link");
    const id = tag(item, "guid") || link || title;
    if (seen.has(id)) continue;
    seen.add(id);

    const location = htmlToText(tag(item, "ev:location"));
    const type = htmlToText(tag(item, "ev:type"));
    const allDay = start.time === "12:00 AM";
    const through = end && end.isoDate !== start.isoDate ? end.date : null;

    const blob = [
      title,
      `Date: ${start.date}`,
      through ? `Through: ${through}` : null,
      allDay ? null : `Time: ${start.time}`,
      type ? `Category: ${type}` : null,
      htmlToText(tag(item, "description")),
      location ? `Venue: ${location}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    out.push({
      sourceId: `${source.id}:${id}`,
      sourceUrl: link || undefined,
      text: blob,
      fetchedAt,
      venueName: location || undefined,
      // No imageUrl — the image pipeline resolves og:image from the detail page.
      _sort: start.instant,
    });
  }

  out.sort((a, b) => a._sort - b._sort);
  const capped = source.maxItems ? out.slice(0, source.maxItems) : out;
  return capped.map(({ _sort, ...r }) => r); // eslint-disable-line @typescript-eslint/no-unused-vars
}
