import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Denver Botanic Gardens calendar (Drupal 10). The /calendar page server-renders
// event cards (`.views-row`) and paginates with ?page=N — no JS, no API. Cards
// carry location/date/time/categories; the per-program detail page (/programs/…)
// has clean Open Graph title/description/image. The calendar is chronological
// (starts today), and recurring programs repeat across days under ONE detail
// URL, so we dedupe by program (keeping the soonest instance) for a diverse
// feed. Configure with `connector: "botanicGardensCalendar"` and `url`
// (the /calendar page).

const DETAIL_CONCURRENCY = 6;
const MAX_PAGES = 8; // safety bound (~20 cards/page)
const TITLE_SUFFIX = /\s*\|\s*Denver Botanic Gardens\s*$/i;

// The two Gardens locations → canonical venue name + address (seeded with the
// correct neighborhoods so we don't depend on geocoder precision).
const LOCATIONS: Record<string, { name: string; address: string }> = {
  "york street": {
    name: "Denver Botanic Gardens",
    address: "1007 York St, Denver, CO 80206",
  },
  "chatfield farms": {
    name: "Denver Botanic Gardens Chatfield Farms",
    address: "8500 W Deer Creek Canyon Rd, Littleton, CO 80128",
  },
};

interface CardMeta {
  detailUrl: string;
  location: string;
  dateText: string;
  timeText: string;
  categories: string;
}

function ogAttr($: cheerio.CheerioAPI, prop: string): string {
  return ($(`meta[property="${prop}"]`).attr("content") ?? "").trim();
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

function parseCards(html: string, origin: string): CardMeta[] {
  const $ = cheerio.load(html);
  const out: CardMeta[] = [];
  $(".views-row").each((_i, el) => {
    const card = $(el);
    const href = card.find("a.program-link").first().attr("href");
    if (!href) return;
    out.push({
      detailUrl: new URL(href, origin).href,
      location: card.find(".field--name-field-atms-location").first().text().trim(),
      dateText: card.find(".program-date").first().text().replace(/\|/g, "").replace(/\s+/g, " ").trim(),
      timeText: card
        .find(".datetime")
        .map((_j, e) => $(e).text().trim())
        .get()
        .filter(Boolean)
        .join(" – "),
      categories: card.find(".program-tags").first().text().replace(/\s+/g, " ").trim(),
    });
  });
  return out;
}

export async function fetchBotanicGardensCalendar(source: SourceConfig): Promise<RawItem[]> {
  const base = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!base) throw new Error(`source ${source.id} missing url`);
  const origin = new URL(base).origin;
  const cap = source.maxItems ?? 40;
  const fetchedAt = new Date().toISOString();

  // Page through the chronological list, keeping the soonest instance of each
  // program, until we have `cap` distinct programs (or run out of pages).
  const byProgram = new Map<string, CardMeta>();
  for (let page = 0; page < MAX_PAGES && byProgram.size < cap; page++) {
    const sep = base.includes("?") ? "&" : "?";
    const cards = parseCards(await fetchHtml(`${base}${sep}page=${page}`), origin);
    if (cards.length === 0) break;
    for (const c of cards) {
      if (!byProgram.has(c.detailUrl)) byProgram.set(c.detailUrl, c);
      if (byProgram.size >= cap) break;
    }
  }
  const kept = [...byProgram.values()].slice(0, cap);

  // Enrich each program with og title/description/image from its detail page.
  const out: RawItem[] = [];
  for (let i = 0; i < kept.length; i += DETAIL_CONCURRENCY) {
    const batch = kept.slice(i, i + DETAIL_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (c): Promise<RawItem | null> => {
        try {
          const $ = cheerio.load(await fetchHtml(c.detailUrl));
          const title = (ogAttr($, "og:title") || $("h1").first().text()).replace(TITLE_SUFFIX, "").trim();
          if (!title) return null;
          const venue = LOCATIONS[c.location.toLowerCase()];
          const slug = c.detailUrl.replace(/\/+$/, "").split("/").pop() || c.detailUrl;
          const blob = [
            title,
            c.dateText ? `Date: ${c.dateText}` : null,
            c.timeText ? `Time: ${c.timeText}` : null,
            c.categories ? `Category: ${c.categories}` : null,
            ogAttr($, "og:description"),
            venue ? `Venue: ${venue.name}, ${venue.address}` : c.location ? `Venue: ${c.location}` : null,
          ]
            .filter(Boolean)
            .join("\n");
          return {
            sourceId: `${source.id}:${slug}`,
            sourceUrl: c.detailUrl,
            text: blob,
            imageUrl: ogAttr($, "og:image") || undefined,
            fetchedAt,
            venueName: venue?.name ?? c.location ?? undefined,
            address: venue?.address,
          };
        } catch {
          return null; // one bad detail page shouldn't sink the run
        }
      }),
    );
    for (const r of results) if (r) out.push(r);
  }
  return out;
}
