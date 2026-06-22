import { createHash } from "node:crypto";
import { ApifyClient } from "apify-client";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Denver Museum of Nature & Science events. dmns.org/purchase/tickets is a
// Blazor Server app (events rendered over a SignalR circuit — no HTML, JSON, or
// feed), AND its ticketing backend blocks datacenter IPs, so a plain fetch or a
// default browser scrape both return nothing. The only thing that works: a real
// browser (apify/web-scraper) routed through a RESIDENTIAL proxy, which clicks
// the "Events" tab and reads the rendered cards. Slow (~1 min) but the cadence
// is weekly. Pin every event to the museum via defaultVenueSlug.
const BROWSER_ACTOR = "apify/web-scraper";
const VENUE = "Denver Museum of Nature & Science";

interface DmnsCard {
  name?: string;
  details?: string;
  img?: string;
  href?: string;
}

// Runs in the browser: wait for the Blazor circuit, click the Events tab until
// real event cards (ones with a dated showtime, vs the "Next available time:
// Loading…" admission tiles) appear, then return one object per event card.
const PAGE_FUNCTION = `
  async function pageFunction(context) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const visible = (el) => !!(el && el.offsetParent !== null);
    const cards = () => Array.from(document.querySelectorAll('.product-category-list-item'));
    const isEvent = (c) => {
      const d = (c.querySelector('.product-category-list-item-details') || {}).textContent || '';
      return /\\b\\d{1,2}:\\d{2}\\s*(AM|PM)\\b/i.test(d) && !/Next available time/i.test(d);
    };
    const hasEvents = () => cards().some(isEvent);
    const findTab = () =>
      Array.from(document.querySelectorAll('button,a,[role=tab]')).find(
        (e) => (e.textContent || '').trim().toLowerCase() === 'events' && visible(e),
      );
    await sleep(12000); // let the SignalR circuit connect + first render settle
    let appeared = false;
    for (let i = 0; i < 45 && !appeared; i++) {
      if (i % 12 === 0) { const t = findTab(); if (t) t.click(); }
      await sleep(1000);
      if (hasEvents()) appeared = true;
    }
    await sleep(1500);
    const out = [];
    for (const c of cards()) {
      if (!isEvent(c)) continue;
      const name = ((c.querySelector('.product-category-list-item-name') || {}).textContent || '').trim();
      if (!name) continue;
      const details = ((c.querySelector('.product-category-list-item-details') || {}).textContent || '').replace(/\\s+/g, ' ').trim();
      const a = c.querySelector('a');
      out.push({
        name,
        details,
        img: (c.querySelector('img') || {}).src || '',
        href: a ? a.href : '',
      });
    }
    return out;
  }
`;

// Pull the human date out of the smooshed details string, e.g.
// "FilmEveningAdults + TeensThursday, June 25, 2026 at 6:30 PM" → that tail.
const DATE_RE =
  /(?:Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day,\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}(?:\s+at\s+\d{1,2}:\d{2}\s*[AP]M)?/;

export async function fetchDmnsEvents(source: SourceConfig): Promise<RawItem[]> {
  const url = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!url) throw new Error(`source ${source.id} missing url`);
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  const client = new ApifyClient({ token });

  const input = {
    startUrls: [{ url }],
    pageFunction: PAGE_FUNCTION,
    injectJQuery: true,
    runMode: "PRODUCTION",
    maxRequestsPerCrawl: 1,
    // Datacenter IPs are blocked by the ticketing backend — residential only.
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"],
      apifyProxyCountry: "US",
    },
  };

  // The render is occasionally flaky; retry the whole run until cards show.
  const rows = await withRetry(
    async () => {
      const run = await client.actor(BROWSER_ACTOR).call(input, { timeout: 600 });
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      const cards = items as DmnsCard[];
      if (cards.length === 0) throw new Error("dmns: no event cards rendered");
      return cards;
    },
    { attempts: 3, baseDelayMs: 2000, shouldRetry: () => true },
  );

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const c of rows) {
    const name = (c.name ?? "").trim();
    if (!name || /cancelled/i.test(name)) continue; // skip cancelled events
    const details = (c.details ?? "").trim();
    const dateText = details.match(DATE_RE)?.[0] ?? "";
    const soldOut = /sold out|unavailable/i.test(details);

    const sourceId = `${source.id}:${createHash("sha1").update(`${name}|${dateText}`).digest("hex").slice(0, 16)}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const text = [
      name,
      dateText && `Date: ${dateText}`,
      `Venue: ${VENUE}`,
      details,
      soldOut && "Note: currently sold out / unavailable.",
    ]
      .filter(Boolean)
      .join("\n");

    out.push({
      sourceId,
      sourceUrl: c.href || url,
      text,
      imageUrl: c.img || undefined,
      fetchedAt,
      venueName: VENUE,
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
