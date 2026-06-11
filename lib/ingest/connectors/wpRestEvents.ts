import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { htmlToText } from "./htmlText";

// Generic WordPress REST events connector. The page itself is a JS-heavy WP
// theme, but the wp-json REST API exposes clean structured records, so we hit a
// wp/v2 collection endpoint (e.g. a custom "atomic-event" post type) and build
// normalizer blobs from the post title + excerpt + the event date parsed out of
// the post body (WordPress stores the human date in the content, not a
// structured field). Configure with `connector: "wpRestEvents"` and `url` (the
// wp-json collection URL without query params — the connector appends per_page
// and the featured-media embed).

interface WpRendered {
  rendered?: string;
}
interface WpEvent {
  id?: number;
  link?: string;
  title?: WpRendered;
  excerpt?: WpRendered;
  content?: WpRendered;
  _embedded?: { "wp:featuredmedia"?: Array<{ source_url?: string }> };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_IDX: Record<string, number> = Object.fromEntries(
  MONTHS.map((m, i) => [m.toLowerCase(), i + 1]),
);
// A single "Month Day[, Year]" token.
const TOKEN = `(${MONTHS.join("|")})\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?`;
const SINGLE_RE = new RegExp(`\\b${TOKEN}`, "i");
// A date range: start token, dash, end token. The end may omit the month (a
// same-month range like "September 13–21"), in which case it reuses the start's.
const RANGE_RE = new RegExp(
  `\\b${TOKEN}\\s*[–—-]\\s*(?:(${MONTHS.join("|")})\\s+)?(\\d{1,2})(?:,?\\s*(\\d{4}))?`,
  "i",
);


function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// These WordPress posts are reused every year, so any embedded year is often
// stale (a "Zoo Lights" post first published in 2024 still carries "January 4
// 2025"). So: trust an embedded year only when it's the current year or later;
// otherwise — and when none is written — assume the current year.
function resolveYear(embedded: number | null, currentYear: number): number {
  return embedded && embedded >= currentYear ? embedded : currentYear;
}

interface ResolvedDate {
  startIso: string;
  endIso: string | null;
  display: string;
}

// Resolve an event's date, preferring a range (so multi-week/summer-long events
// that started before today but run into the future aren't mistaken for past).
function resolveEventDate(text: string, currentYear: number): ResolvedDate | null {
  const range = text.match(RANGE_RE);
  if (range) {
    const sMonth = MONTH_IDX[range[1].toLowerCase()];
    const sDay = Number(range[2]);
    const sYear = resolveYear(range[3] ? Number(range[3]) : null, currentYear);
    const eMonth = (range[4] ? MONTH_IDX[range[4].toLowerCase()] : sMonth) ?? sMonth;
    const eDay = Number(range[5]);
    // End year: trust a sane embedded one; otherwise roll to next year when the
    // end month precedes the start month (e.g. "Nov 24 – Jan 4" wraps).
    const eEmbedded = range[6] ? Number(range[6]) : null;
    const eYear =
      eEmbedded && eEmbedded >= sYear ? eEmbedded : eMonth < sMonth ? sYear + 1 : sYear;
    const display =
      sYear === eYear
        ? `${MONTHS[sMonth - 1]} ${sDay} – ${MONTHS[eMonth - 1]} ${eDay}, ${eYear}`
        : `${MONTHS[sMonth - 1]} ${sDay}, ${sYear} – ${MONTHS[eMonth - 1]} ${eDay}, ${eYear}`;
    return { startIso: iso(sYear, sMonth, sDay), endIso: iso(eYear, eMonth, eDay), display };
  }

  const single = text.match(SINGLE_RE);
  if (!single) return null;
  const month = MONTH_IDX[single[1].toLowerCase()];
  if (!month) return null;
  const day = Number(single[2]);
  const year = resolveYear(single[3] ? Number(single[3]) : null, currentYear);
  return {
    startIso: iso(year, month, day),
    endIso: null,
    display: `${MONTHS[month - 1]} ${day}, ${year}`,
  };
}

export async function fetchWpRestEvents(source: SourceConfig): Promise<RawItem[]> {
  const base = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!base) throw new Error(`source ${source.id} missing url`);
  const limit = Math.min(source.maxItems ?? 50, 100);
  const sep = base.includes("?") ? "&" : "?";
  const url = `${base}${sep}per_page=${limit}&_embed=wp:featuredmedia`;

  const events = await withRetry(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`wp rest fetch failed: status ${res.status}`);
    const json = await res.json();
    return Array.isArray(json) ? (json as WpEvent[]) : [];
  });

  const now = new Date();
  const todayDenver = now.toLocaleDateString("en-CA", { timeZone: "America/Denver" });
  const currentYear = Number(
    now.toLocaleString("en-US", { timeZone: "America/Denver", year: "numeric" }),
  );
  const fetchedAt = now.toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const e of events) {
    if (!e.id) continue;
    const title = htmlToText(e.title?.rendered);
    if (!title) continue;

    // The REST API returns every published post — past editions of recurring
    // events and undated seasonal landing pages included. Require a real event
    // date (in the body, falling back to the title) and keep only this-year-or-
    // later occurrences, so the output matches the site's upcoming view rather
    // than the full archive.
    const body = htmlToText(e.content?.rendered);
    const date =
      resolveEventDate(body, currentYear) ?? resolveEventDate(title, currentYear);
    // Keep anything not yet over: an ongoing event (started before today but
    // ending later) stays; a single-date event past today goes.
    if (!date || (date.endIso ?? date.startIso) < todayDenver) continue;

    const sourceId = String(e.id);
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const excerpt = htmlToText(e.excerpt?.rendered);
    const blob = [title, `Date: ${date.display}`, excerpt].filter(Boolean).join("\n");

    out.push({
      sourceId,
      sourceUrl: e.link,
      text: blob,
      imageUrl: e._embedded?.["wp:featuredmedia"]?.[0]?.source_url,
      fetchedAt,
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
