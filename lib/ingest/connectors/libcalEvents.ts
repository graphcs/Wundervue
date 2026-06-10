import type { RawItem, SourceConfig } from "../types";
import { fetchJson } from "./feedFetch";

// Springshare LibCal calendars (used by most public libraries — e.g. Denver
// Public Library) render events client-side from a clean JSON endpoint:
//   <base>/ajax/calendar/list?c=-1&m=list&date=<YYYY-MM-DD>&page=<n>
// c=-1 is "all calendars". Returns { total_results, perpage, results:[…] } with
// title, fromTime (venue-local), location, categories, shortdesc, url, and a
// featured_image. Configure with `connector: "libcalEvents"` and `url` = the
// LibCal base origin. Multi-branch, so pin nothing — venues resolve per event.
const MAX_PAGES = 6;

interface LibCalEvent {
  id?: number;
  title?: string;
  shortdesc?: string;
  fromTime?: string;
  startdt?: string;
  date?: string;
  all_day?: boolean;
  url?: string;
  location?: string;
  categories?: string;
  featured_image?: string;
}
interface LibCalResponse {
  total_results?: number;
  perpage?: number;
  results?: LibCalEvent[];
}

function denverToday(): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function fetchLibCalEvents(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url || Array.isArray(source.url)) {
    throw new Error(`source ${source.id} needs a single base url`);
  }
  const base = source.url.replace(/\/$/, "");
  const today = denverToday();
  const max = source.maxItems ?? 40;

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];

  for (let page = 1; page <= MAX_PAGES && out.length < max; page++) {
    const url = `${base}/ajax/calendar/list?c=-1&m=list&date=${today}&page=${page}`;
    const data = await fetchJson<LibCalResponse>(url, { "X-Requested-With": "XMLHttpRequest" });

    const results = data.results ?? [];
    if (results.length === 0) break;

    for (const e of results) {
      const title = e.title?.trim();
      if (!title || !e.id) continue;
      const sourceId = `${source.id}:${e.id}`;
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);
      // fromTime is "8:30 am Wednesday, June 10, 2026" (venue-local); date is the
      // day-only fallback for all-day events.
      const dateLine = e.all_day ? e.date : e.fromTime || e.startdt || e.date;
      const text = [
        title,
        dateLine && `Date: ${dateLine}`,
        e.location && `Venue: ${e.location}`,
        e.categories && `Category: ${e.categories}`,
        e.shortdesc?.trim(),
      ]
        .filter(Boolean)
        .join("\n");
      out.push({
        sourceId,
        sourceUrl: e.url,
        text,
        imageUrl: e.featured_image || undefined,
        fetchedAt,
      });
      if (out.length >= max) break;
    }

    const perpage = data.perpage ?? results.length;
    const total = data.total_results ?? results.length;
    if (page * perpage >= total) break;
  }
  return out;
}
