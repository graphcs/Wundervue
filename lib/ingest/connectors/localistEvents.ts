import { createHash } from "node:crypto";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Localist events platform (powers many university/city calendars, e.g. CU
// Boulder's calendar.colorado.edu, embedded on colorado.edu/events as a
// localist-widget). Localist exposes a clean JSON API at /api/2/events with
// structured tz-aware instances, location+address, image, and detail URL — so we
// read that instead of scraping the widget. Set `url` to the full API query with
// the desired filters (e.g. `?featured=true&days=60&pp=50` to match a site's
// curated "featured" feed and skip administrative/academic-deadline noise).
// Recurring events arrive pre-expanded into instances; we cap per event.

const MAX_INSTANCES = 6;

// Drop recurrence phrasing ("Every Thursday until Halloween") from a per-instance
// description so the LLM labels date_display with the instance's specific day
// rather than echoing the series cadence — each row is one concrete occurrence.
function stripRecurrencePhrases(s: string): string {
  return s
    .replace(
      /\bevery\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day\b[^.!?\n]*/gi,
      "",
    )
    .replace(/\b(?:weekly|every\s+week|every\s+day|each\s+week)\b[^.!?\n]*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

interface LocalistInstance {
  start?: string;
  end?: string;
  all_day?: boolean;
}
interface LocalistEvent {
  title?: string;
  localist_url?: string;
  photo_url?: string;
  location_name?: string;
  address?: string;
  free?: boolean;
  description_text?: string;
  event_instances?: { event_instance: LocalistInstance }[];
}
interface LocalistResponse {
  events?: { event: LocalistEvent }[];
}

export async function fetchLocalistEvents(source: SourceConfig): Promise<RawItem[]> {
  const apiUrl = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!apiUrl) throw new Error(`source ${source.id} missing url`);

  const json = await withRetry(async () => {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`localist fetch failed: status ${res.status}`);
    return (await res.json()) as LocalistResponse;
  });

  const now = Date.now();
  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];

  for (const wrapper of json.events ?? []) {
    const e = wrapper.event;
    if (!e?.title) continue;
    // Each recurring event arrives with all its instances; keep upcoming ones
    // (small grace for today), soonest first, capped so a weekly series can't
    // flood the feed. Each instance becomes its own specific-day listing.
    const instances = (e.event_instances ?? [])
      .map((i) => i.event_instance)
      .filter((i): i is LocalistInstance & { start: string } =>
        Boolean(i.start) && Date.parse(i.start!) >= now - 86400000,
      )
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, MAX_INSTANCES);

    for (const inst of instances) {
      const day = inst.start.slice(0, 10);
      const sourceId = `${source.id}:${createHash("sha1")
        .update(`${e.title}|${day}`)
        .digest("hex")
        .slice(0, 12)}`;
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);

      const venue = e.location_name || "";
      const text = [
        e.title,
        // tz-aware ISO (e.g. "…T19:30:00-06:00") — normalize reads day + time.
        `Date: ${inst.start}`,
        venue || e.address ? `Venue: ${venue}${e.address ? `, ${e.address}` : ""}` : null,
        e.free ? "Free admission" : null,
        stripRecurrencePhrases((e.description_text ?? "").trim()).slice(0, 500) || null,
      ]
        .filter(Boolean)
        .join("\n");

      out.push({
        sourceId,
        sourceUrl: e.localist_url ?? undefined,
        text,
        imageUrl: e.photo_url || undefined,
        venueName: venue || undefined,
        address: e.address || undefined,
        // Already a specific dated instance — don't let the LLM re-read the
        // "Every Thursday" description and double-expand via occurrence splitting.
        recurring: false,
        fetchedAt,
      });
    }
  }

  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
