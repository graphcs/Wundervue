import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Downtown Aquarium (Landry's) calendar.asp — a server-rendered, full-year
// events page with no semantic markup: 12 month <h2> headers, each followed by
// a <ul> of event <li>s whose text begins with the day-of-month. The flat
// cheerioWeb connector can't use it because (a) the month/year lives in the <h2>
// above each <li>, not in the item itself, and (b) the page is Windows-1252
// encoded, so the default UTF-8 decode mangles every apostrophe/dash. This
// connector walks month → events to attach correct dates, decodes win-1252, and
// drops the high-volume, repetitive program registrations (Wild Dreams
// Overnight, Marine Biologist/Zoologist for a Day, summer camps, Family Nights)
// so only the discoverable special events survive. Configure with
// `connector: "aquariumCalendar"` and `url` (the calendar.asp page).

const VENUE = "Downtown Aquarium";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_RE = new RegExp(`^(${MONTHS.join("|")})\\s+(\\d{4})$`);

// Leading day-of-month, then the rest of the entry. The "rest" may still begin
// with a multi-day range/list fragment ("– 25, 31 …") which TITLE_LEAD strips.
const DAY_RE = /^(\d{1,2})\s+(.+)$/;
// Leading date-fragment junk (extra days, ranges, commas, dashes) before the
// real title text starts at its first letter.
const TITLE_LEAD = /^[\d\s,.–—-]+(?=[A-Za-z])/;

// Repetitive program/camp registrations that recur weekly all year — ~65% of
// the calendar. They flood the app with near-identical listings, so drop them
// and keep the one-off special events (animal days, festivals, holiday dinners).
const NOISE_RE =
  /wild dreams overnight|marine biologist for a day|zoologist for a day|family nights|homeschool day|summer camp|steam camp|mystic mermaid/i;

export async function fetchAquariumCalendar(source: SourceConfig): Promise<RawItem[]> {
  const url = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!url) throw new Error(`source ${source.id} missing url`);

  const html = await withRetry(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`fetch ${url} failed: status ${res.status}`);
    // Page is Windows-1252 with no charset header — decode the raw bytes so
    // smart quotes/dashes come through as real characters, not mojibake.
    const buf = await res.arrayBuffer();
    return new TextDecoder("windows-1252").decode(buf);
  });

  const $ = cheerio.load(html);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" });
  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];

  $("h2").each((_i, h) => {
    const m = $(h).text().trim().match(MONTH_RE);
    if (!m) return;
    const monthIdx = MONTHS.indexOf(m[1]) + 1;
    const year = Number(m[2]);

    $(h)
      .next("ul")
      .find("li")
      .each((_j, li) => {
        const text = $(li).text().trim().replace(/\s+/g, " ");
        const dm = text.match(DAY_RE);
        // No leading day = an undated, month-long recurring promo — skip.
        if (!dm) return;
        const day = Number(dm[1]);
        // Strip any leftover leading range/list fragment ("– 25, 31 ") so the
        // title starts at the event name.
        const title = dm[2].replace(TITLE_LEAD, "").trim();
        if (!title || NOISE_RE.test(title)) return;

        const iso = `${year}-${String(monthIdx).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (iso < today) return; // future events only

        const sourceId = `${source.id}:${iso}:${createHash("sha1").update(title).digest("hex").slice(0, 10)}`;
        if (seen.has(sourceId)) return;
        seen.add(sourceId);

        const monthName = MONTHS[monthIdx - 1];
        const blob = [
          title,
          `Date: ${monthName} ${day}, ${year}`,
          `Venue: ${VENUE}, Denver`,
        ].join("\n");

        out.push({
          sourceId,
          sourceUrl: url,
          text: blob,
          fetchedAt,
          venueName: VENUE,
        });
      });
  });

  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
