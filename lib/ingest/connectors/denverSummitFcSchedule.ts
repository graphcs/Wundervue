import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Denver Summit FC (NWSL) schedule. The /schedule/ page server-renders match
// cards (`.schedule__match`) with a Home/Away indicator, date ("Jul 3", no
// year), time, opponent, and venue. We keep only HOME matches (at DICK'S
// Sporting Goods Park, Commerce City) — away games aren't local. Configure with
// `connector: "denverSummitFcSchedule"`, `url` (the schedule page), and
// `defaultVenueSlug` (dick-s-sporting-goods-park).

const TEAM = "Denver Summit FC";
const VENUE = "DICK'S Sporting Goods Park";
const ADDRESS = "6000 Victory Way, Commerce City, CO 80022";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_IDX: Record<string, number> = {};
MONTHS.forEach((m, i) => (MONTH_IDX[m.slice(0, 3).toLowerCase()] = i + 1));

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export async function fetchDenverSummitFcSchedule(source: SourceConfig): Promise<RawItem[]> {
  const url = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!url) throw new Error(`source ${source.id} missing url`);

  const html = await withRetry(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`fetch ${url} failed: status ${res.status}`);
    return res.text();
  });

  const $ = cheerio.load(html);
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Denver" });
  const curYear = Number(now.toLocaleString("en-US", { timeZone: "America/Denver", year: "numeric" }));
  const curMonth = Number(now.toLocaleString("en-US", { timeZone: "America/Denver", month: "numeric" }));
  const fetchedAt = now.toISOString();

  const out: Array<RawItem & { _sort: string }> = [];
  const seen = new Set<string>();

  $(".schedule__match").each((_i, el) => {
    const card = $(el);
    // Home games only — away matches aren't local.
    if (!/home/i.test(clean(card.find(".schedule__match-indicator-label").first().text()))) return;

    const opponent = clean(card.find(".schedule__match-opponent-name").first().text());
    const dateText = clean(card.find(".schedule__match-date").first().text()); // "Jul 3"
    const m = dateText.match(/([A-Za-z]{3,})\.?\s+(\d{1,2})/);
    if (!opponent || !m) return;
    const month = MONTH_IDX[m[1].slice(0, 3).toLowerCase()];
    const day = Number(m[2]);
    if (!month || day < 1 || day > 31) return;
    // Date has no year — the soccer season runs within a year, so use the
    // current year, rolling to next year for months already behind us.
    const year = month >= curMonth ? curYear : curYear + 1;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (iso < today) return; // already played

    const sourceId = `${source.id}:${opponent.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${iso}`;
    if (seen.has(sourceId)) return;
    seen.add(sourceId);

    const time = clean(card.find(".schedule__match-time").first().text()); // "7:30PM MDT"
    const ticketUrl = card
      .find("a[href]")
      .map((_j, a) => $(a).attr("href"))
      .get()
      .find((h) => h && /ticket/i.test(h));

    const blob = [
      `${TEAM} vs ${opponent}`,
      `Date: ${MONTHS[month - 1]} ${day}, ${year}`,
      time ? `Time: ${time}` : null,
      "Category: Sports",
      `NWSL home match: ${TEAM} host ${opponent}.`,
      `Venue: ${VENUE}, ${ADDRESS}`,
    ]
      .filter(Boolean)
      .join("\n");

    out.push({
      sourceId,
      sourceUrl: ticketUrl || url,
      text: blob,
      fetchedAt,
      venueName: VENUE,
      address: ADDRESS,
      _sort: iso,
    });
  });

  out.sort((a, b) => a._sort.localeCompare(b._sort));
  const capped = source.maxItems ? out.slice(0, source.maxItems) : out;
  return capped.map(({ _sort, ...r }) => r); // eslint-disable-line @typescript-eslint/no-unused-vars
}
