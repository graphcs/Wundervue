import { createHash } from "node:crypto";
import { ApifyClient } from "apify-client";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// PopMenu venue events (e.g. The Goldfinch). The /events page sits behind a
// Cloudflare JS challenge and renders a React calendar client-side, so we drive
// it with a real browser over a residential proxy (clears the challenge, like
// dmnsEvents) and read the event cards — each links to /events/<slug> and shows
// a schedule line ("Weekly Wed", "Wed, Jun 24, 6:30 pm", "Weekends at 10am").
// The normalizer turns the recurring lines into recurring listings. Point `url`
// at the venue's /events page and set defaultVenueName. Reusable for any PopMenu
// venue.
const BROWSER_ACTOR = "apify/web-scraper";

interface PopmenuCard {
  href?: string;
  title?: string;
  text?: string;
  img?: string;
}

// Runs in the browser: wait for Cloudflare + the calendar to render, then return
// one object per event card (deduped by its /events/<slug> link).
const PAGE_FUNCTION = `
  async function pageFunction(context) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(13000);
    const seen = new Set();
    const out = [];
    for (const a of Array.from(document.querySelectorAll('a[href*="/events/"]'))) {
      const href = a.href;
      if (!href || seen.has(href)) continue;
      let card = a;
      for (let i = 0; i < 6; i++) {
        if (!card.parentElement) break;
        card = card.parentElement;
        if (card.querySelector('h2,h3,h4') && card.querySelector('img')) break;
      }
      const h = card.querySelector('h2,h3,h4');
      const title = h ? (h.textContent || '').replace(/\\s+/g, ' ').trim() : '';
      if (!title) continue;
      seen.add(href);
      out.push({
        href,
        title,
        text: (card.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 600),
        img: (card.querySelector('img') || {}).src || '',
      });
    }
    return out;
  }
`;

export async function fetchPopmenuEvents(source: SourceConfig): Promise<RawItem[]> {
  const url = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!url) throw new Error(`source ${source.id} missing url (PopMenu events page)`);
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  const client = new ApifyClient({ token });

  const cards = await withRetry(
    async () => {
      const run = await client.actor(BROWSER_ACTOR).call(
        {
          startUrls: [{ url }],
          pageFunction: PAGE_FUNCTION,
          injectJQuery: false,
          runMode: "PRODUCTION",
          maxRequestsPerCrawl: 1,
          // Cloudflare blocks datacenter IPs — residential clears the challenge.
          proxyConfiguration: {
            useApifyProxy: true,
            apifyProxyGroups: ["RESIDENTIAL"],
            apifyProxyCountry: "US",
          },
        },
        { timeout: 600 },
      );
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      const rows = items as PopmenuCard[];
      if (rows.length === 0) throw new Error("popmenu: no event cards rendered");
      return rows;
    },
    { attempts: 3, baseDelayMs: 2000, shouldRetry: () => true },
  );

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const c of cards) {
    const title = (c.title ?? "").trim();
    if (!title || !c.href) continue;
    // Stable id from the /events/<slug> tail.
    const slug = c.href.replace(/\/+$/, "").split("/").pop() || createHash("sha1").update(c.href).digest("hex").slice(0, 12);
    const sourceId = `${source.id}:${slug}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    // The card text leads with a date chip smashed into the title; the schedule
    // line ("Weekly Wed", "Wed, Jun 24, 6:30 pm") + description follow. Pass the
    // title first, then the card body, and let the normalizer parse it.
    const text = [title, c.text ?? "", source.defaultVenueName ? `Venue: ${source.defaultVenueName}` : ""]
      .filter(Boolean)
      .join("\n");

    out.push({
      sourceId,
      sourceUrl: c.href,
      text,
      imageUrl: c.img || undefined,
      fetchedAt,
      venueName: source.defaultVenueName,
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
