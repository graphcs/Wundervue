import { createHash } from "node:crypto";
import { ApifyClient } from "apify-client";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Elfsight "Events Calendar" widget (class `eapp-events-calendar`, built on
// FullCalendar `.fc-event`). Many venue sites embed it — e.g. Improper City's
// food-truck schedule. The events are NOT in the page HTML and have no public
// feed (Elfsight pulls them from a private, OAuth-connected Google Calendar), so
// we render the page in a browser and read the calendar grid: each `.fc-event`
// carries the truck/title + time, and its day comes from the enclosing
// `td[data-date]`. Configure with `connector: "elfsightCalendar"` and `url` (the
// page hosting the widget); pin single-venue sources via defaultVenueSlug /
// defaultVenueName + defaultVenueAddress.
const BROWSER_ACTOR = "apify/web-scraper";

interface CalEvent {
  date?: string;
  title?: string;
  time?: string;
  href?: string;
}

// Runs in the browser: wait for the widget to render, then return one row per
// event with its day (from the parent cell), title, and time.
const PAGE_FUNCTION = `
  async function pageFunction(context) {
    const { waitFor } = context;
    try { await waitFor('.fc-event', { timeoutMillis: 25000 }); } catch (e) {}
    await new Promise((r) => setTimeout(r, 3000));
    const out = [];
    const seen = new Set();
    for (const ev of Array.from(document.querySelectorAll('.fc-event'))) {
      const td = ev.closest('td[data-date]');
      const date = td ? td.getAttribute('data-date') : '';
      const title = ((ev.querySelector('[class*="EventContent__Title"], .fc-event-title') || {}).textContent || '').trim();
      // Strip the trailing "UTC-6" Elfsight appends to the time label.
      const time = ((ev.querySelector('[class*="EventContent__Time"], .fc-event-time') || {}).textContent || '')
        .replace(/\\s+/g, ' ').replace(/\\s*UTC[+-]?\\d*/i, '').trim();
      const href = ev.getAttribute('href') || '';
      if (!title || !date) continue;
      const key = date + '|' + title;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ date, title, time, href });
    }
    return out;
  }
`;

export async function fetchElfsightCalendar(source: SourceConfig): Promise<RawItem[]> {
  const url = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!url) throw new Error(`source ${source.id} missing url`);
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  const client = new ApifyClient({ token });

  const run = await withRetry(() =>
    client.actor(BROWSER_ACTOR).call(
      {
        startUrls: [{ url }],
        pageFunction: PAGE_FUNCTION,
        injectJQuery: false,
        runMode: "PRODUCTION",
        maxRequestsPerCrawl: 1,
      },
      { timeout: 300 },
    ),
  );

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const fetchedAt = new Date().toISOString();
  const now = Date.now();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const r of items as CalEvent[]) {
    if (!r.title || !r.date) continue;
    // Keep upcoming only — the rendered grid includes the whole current month,
    // and the day is the venue's local calendar date (compare at end-of-day).
    if (Date.parse(`${r.date}T23:59:59`) < now) continue;
    const sourceId = `${source.id}:${r.date}:${createHash("sha1").update(r.title).digest("hex").slice(0, 8)}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    const text = [r.title, `Date: ${r.date}`, r.time ? `Time: ${r.time}` : null]
      .filter(Boolean)
      .join("\n");
    out.push({
      sourceId,
      sourceUrl: r.href ? new URL(r.href, url).href : url,
      text,
      fetchedAt,
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
