import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Denver Union Station event calendar. The /experience/event-calendar/ page is
// JS-rendered (no events in the HTML) and there's no events REST collection,
// but it's a WordPress site whose events-sitemap.xml lists every event detail
// page, and those pages ARE server-rendered with clean Open Graph tags
// (og:title/description/image), an event_category taxonomy, and the date(s) in
// the body. So: read the sitemap, fetch each detail page, and build a normalizer
// blob from the OG fields + the soonest upcoming date. Configure with
// `connector: "denverUnionStation"` and `url` (the events-sitemap.xml).

const VENUE = "Denver Union Station";
const ADDRESS = "1701 Wynkoop St, Denver, CO 80202";
const TITLE_SUFFIX = /\s*\|\s*Denver Union Station\s*$/i;
const DETAIL_CONCURRENCY = 6;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_IDX: Record<string, number> = {};
MONTHS.forEach((m, i) => {
  MONTH_IDX[m.toLowerCase()] = i + 1;
  MONTH_IDX[m.slice(0, 3).toLowerCase()] = i + 1; // 3-letter abbreviation
});
// "June 6", "Jun 27", "July 3rd", "September 27, 2026" — month (full/abbrev),
// day, optional ordinal, optional 4-digit year.
const DATE_RE =
  /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/gi;

interface UpcomingDate {
  iso: string;
  display: string;
}

// Extract every month/day(/year) token from the page text and resolve to the
// upcoming occurrences. A token's year defaults to the current year (never
// rolled forward), so a one-off whose only dates are in the past drops out,
// while a recurring event keeps its remaining dates this year. Returns them
// sorted soonest-first; empty when nothing upcoming.
function upcomingDates(text: string, today: string, currentYear: number): UpcomingDate[] {
  const seen = new Set<string>();
  const out: UpcomingDate[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const month = MONTH_IDX[m[1].toLowerCase()];
    if (!month) continue;
    const day = Number(m[2]);
    if (day < 1 || day > 31) continue;
    const year = m[3] ? Number(m[3]) : currentYear;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (iso < today || seen.has(iso)) continue;
    seen.add(iso);
    out.push({ iso, display: `${MONTHS[month - 1]} ${day}, ${year}` });
  }
  return out.sort((a, b) => a.iso.localeCompare(b.iso));
}

function attr($: cheerio.CheerioAPI, prop: string): string {
  return ($(`meta[property="${prop}"]`).attr("content") ?? "").trim();
}

// Turn an event_category slug ("public-event", "family-kids") into a label.
function categoryLabel(html: string): string | null {
  const m = html.match(/event_category=([a-z0-9-]+)/i);
  if (!m) return null;
  return m[1]
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchHtml(url: string): Promise<string> {
  return withRetry(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`fetch ${url} failed: status ${res.status}`);
    return res.text();
  });
}

function parseDetail(
  url: string,
  html: string,
  today: string,
  currentYear: number,
  sourceId: string,
  fetchedAt: string,
): RawItem | null {
  const $ = cheerio.load(html);
  const title = (attr($, "og:title") || $("h1").first().text()).replace(TITLE_SUFFIX, "").trim();
  if (!title) return null;

  const dates = upcomingDates($("body").text().replace(/\s+/g, " "), today, currentYear);
  if (dates.length === 0) return null; // past one-off — skip

  const description = attr($, "og:description");
  const image = attr($, "og:image") || undefined;
  const category = categoryLabel(html);
  const extra = dates.slice(1, 4).map((d) => d.display);

  const blob = [
    title,
    `Date: ${dates[0].display}`,
    extra.length ? `Additional dates: ${extra.join("; ")}` : null,
    category ? `Category: ${category}` : null,
    description,
    `Venue: ${VENUE}, ${ADDRESS}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    sourceId,
    sourceUrl: url,
    text: blob,
    imageUrl: image,
    fetchedAt,
    venueName: VENUE,
    address: ADDRESS,
    // soonest upcoming date, used for sorting before the maxItems cap
    _sortKey: dates[0].iso,
  } as RawItem & { _sortKey: string };
}

export async function fetchDenverUnionStation(source: SourceConfig): Promise<RawItem[]> {
  const sitemapUrl = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!sitemapUrl) throw new Error(`source ${source.id} missing url`);

  const sitemap = await fetchHtml(sitemapUrl);
  // <loc> values may be CDATA-wrapped (AIOSEO) or plain — handle both.
  const urls = [...sitemap.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim())
    .filter((u) => /\/events\//.test(u));

  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Denver" });
  const currentYear = Number(
    now.toLocaleString("en-US", { timeZone: "America/Denver", year: "numeric" }),
  );
  const fetchedAt = now.toISOString();

  // Fetch detail pages with a small concurrency pool (88+ pages otherwise serialize).
  const items: Array<RawItem & { _sortKey: string }> = [];
  for (let i = 0; i < urls.length; i += DETAIL_CONCURRENCY) {
    const batch = urls.slice(i, i + DETAIL_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (url) => {
        try {
          const html = await fetchHtml(url);
          const slug = url.replace(/\/+$/, "").split("/").pop() ?? createHash("sha1").update(url).digest("hex").slice(0, 10);
          return parseDetail(url, html, today, currentYear, `${source.id}:${slug}`, fetchedAt);
        } catch {
          return null; // one bad page shouldn't sink the whole run
        }
      }),
    );
    for (const r of results) if (r) items.push(r as RawItem & { _sortKey: string });
  }

  // Soonest-first, then cap so only the nearest events hit LLM normalization.
  items.sort((a, b) => a._sortKey.localeCompare(b._sortKey));
  const capped = source.maxItems ? items.slice(0, source.maxItems) : items;
  return capped.map(({ _sortKey, ...item }) => item); // eslint-disable-line @typescript-eslint/no-unused-vars
}
