import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Comedy Works (comedyworks.com) runs two Denver clubs — Downtown (LoDo) and
// South (Greenwood Village) — off a single Rails app whose calendar is paged one
// month per URL (?month=M&year=Y). Each calendar day cell carries a machine
// `data-date` and a list of events; every event links to a /comedians/<slug>
// "show" page that holds the real detail: the run's showtimes (date + time),
// ticket price, the club's name/address, and a description. The flat cheerioWeb
// connector can't use the calendar because (a) it only shows one month at a time
// so a single fetch misses the next month's shows, and (b) the per-event date,
// times, prices and venue are split across the cell attribute and the linked
// show page. This connector walks the current month plus `monthsAhead` upcoming
// months to discover every show page, fetches each once to read its showtimes,
// and emits one item per show-date so a multi-night run becomes one listing per
// night. The two clubs are separate physical venues, so run one source per club
// with `comedyWorksClub` + a matching `defaultVenueSlug` — the connector filters
// the interleaved calendar to that club and the pipeline pins it authoritatively
// (no reliance on LLM venue extraction). Configure with
// `connector: "comedyWorksCalendar"`, `url` (the /shows/calendar page),
// `comedyWorksClub` ("downtown" | "south"), and optional `monthsAhead` (default 3).

const MONTH_ABBREV: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

// A show-page showtime header, e.g. "Friday, Jun 05 2026  7:00PM".
const SHOW_DAY_RE =
  /^[A-Za-z]+,\s+([A-Za-z]{3})[a-z]*\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)$/;

type Club = "downtown" | "south";

interface Discovered {
  href: string;            // "/comedians/steven-ho"
  title: string;           // calendar display name, e.g. "Steven Ho"
  location: string | null; // "Comedy Works Downtown" | "Comedy Works South"
  dates: Set<string>;      // ISO dates this show appears on the calendar (fallback)
}

// One club's slice of a show page: a comedian booked at both clubs has two of
// these (and external "concerts" runs list other venues entirely), each with its
// own venue and showtimes.
interface ClubSection {
  club: Club | null; // from the club-title's club-downtown/club-south class
  venueName: string | null;
  address: string | null;
  // ISO date -> list of times ("7:00 PM"), parsed from this club's show-times.
  timesByDate: Map<string, string[]>;
}

interface ShowDetail {
  description: string | null;
  price: string | null; // "$35 - $45" | "$25" | null
  imageUrl: string | null;
  sections: ClubSection[];
}

function abs(origin: string, path: string): string {
  return path.startsWith("http") ? path : `${origin}${path}`;
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

// Walk the calendar grid for one month, appending every event to `byHref` keyed
// by show-page link so a run spanning several days collapses to one entry whose
// `dates` set lists each appearance. When `club` is set, keep only that club's
// events — the location element carries a `downtown`/`south`/`concerts` class
// (the same tags the site's own filter toggles use); untagged or external
// (`concerts`, e.g. shows at the Paramount) events are dropped.
function collectMonth(
  html: string,
  byHref: Map<string, Discovered>,
  today: string,
  club?: Club,
): void {
  const $ = cheerio.load(html);
  $("td.calendar-hasevent").each((_i, td) => {
    const date = $(td).attr("data-date");
    if (!date || date < today) return; // future show-dates only
    $(td)
      .find("li.calendar-event")
      .each((_j, li) => {
        const titleA = $(li).find("h3.calendar-event-title a").first();
        const title = titleA.text().trim().replace(/\s+/g, " ");
        const href = titleA.attr("href");
        if (!title || !href) return;
        const locEl = $(li).find(".calendar-event-location").first();
        const eventClub: Club | null = locEl.hasClass("south")
          ? "south"
          : locEl.hasClass("downtown")
            ? "downtown"
            : null;
        if (club && eventClub !== club) return; // not this source's club
        // `|| null` so an empty location element doesn't defeat the nullish
        // venueName fallback in the emit loop.
        const location = locEl.text().trim().replace(/\s+/g, " ") || null;
        const existing = byHref.get(href);
        if (existing) {
          existing.dates.add(date);
        } else {
          byHref.set(href, { href, title, location, dates: new Set([date]) });
        }
      });
  });
}

// Parse a show page into structured detail. Best-effort: any missing piece is
// returned null/empty rather than throwing, so one odd page can't fail the run.
function parseShowDetail(html: string, origin: string): ShowDetail {
  const $ = cheerio.load(html);

  const description =
    $(".comedian-desc")
      .first()
      .children("h1")
      .remove()
      .end()
      .text()
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 600) || null;

  const imgSrc = $(".comedian-intro img.comedian_photo").first().attr("src");
  const imageUrl = imgSrc ? abs(origin, imgSrc) : null;

  // Ticket prices live in per-section labels; reduce them to a min–max hint.
  const prices: number[] = [];
  $(".product-price").each((_i, el) => {
    const m = $(el).text().match(/\$([\d.]+)/);
    if (m) prices.push(Number(m[1]));
  });
  let price: string | null = null;
  if (prices.length) {
    const fmt = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    price = lo === hi ? fmt(lo) : `${fmt(lo)} - ${fmt(hi)}`;
  }

  // Each club this show plays has its own `.ticket-location/.club` block
  // followed by a sibling `ul.show-times`. Pair every show-times list with the
  // nearest preceding club block so a comedian booked at both clubs keeps its
  // dates attributed to the right venue (and external "concerts" venues stay on
  // their own section, club=null).
  const sections: ClubSection[] = [];
  $("ul.show-times").each((_i, ul) => {
    const titleEl = $(ul).prevAll(".ticket-location").first().find(".club-title").first();
    const club: Club | null = titleEl.hasClass("club-south")
      ? "south"
      : titleEl.hasClass("club-downtown")
        ? "downtown"
        : null;
    const venueName = titleEl.text().trim().replace(/\s+/g, " ") || null;
    // "1226 15th Street Denver, CO 80202 map" — drop the trailing "map" link.
    const address =
      $(ul)
        .prevAll(".ticket-location")
        .first()
        .find(".club-address")
        .first()
        .clone()
        .children("a")
        .remove()
        .end()
        .text()
        .trim()
        .replace(/\s+/g, " ") || null;

    const timesByDate = new Map<string, string[]>();
    $(ul)
      .find("p.show-day")
      .each((_j, el) => {
        const m = $(el).text().trim().replace(/\s+/g, " ").match(SHOW_DAY_RE);
        if (!m) return;
        const month = MONTH_ABBREV[m[1]];
        if (!month) return;
        const iso = `${m[3]}-${String(month).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
        const time = m[4].replace(/([AP]M)$/, " $1").replace(/\s+/g, " ").trim();
        const list = timesByDate.get(iso) ?? [];
        list.push(time);
        timesByDate.set(iso, list);
      });

    sections.push({ club, venueName, address, timesByDate });
  });

  return { description, price, imageUrl, sections };
}

export async function fetchComedyWorksCalendar(source: SourceConfig): Promise<RawItem[]> {
  const baseUrl = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!baseUrl) throw new Error(`source ${source.id} missing url`);
  const origin = new URL(baseUrl).origin;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" });
  const [y, m] = today.split("-").map(Number);
  const monthsAhead = source.monthsAhead ?? 3;

  // Discover every upcoming show across the current month + N following months.
  const byHref = new Map<string, Discovered>();
  for (let i = 0; i <= monthsAhead; i++) {
    const month = ((m - 1 + i) % 12) + 1;
    const year = y + Math.floor((m - 1 + i) / 12);
    const u = new URL(baseUrl);
    u.searchParams.set("month", String(month));
    u.searchParams.set("year", String(year));
    collectMonth(await fetchHtml(u.toString()), byHref, today, source.comedyWorksClub);
  }

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  const limit = source.maxItems;
  // The date is the sourceId's trailing segment.
  const dateOf = (r: RawItem) => r.sourceId.slice(r.sourceId.lastIndexOf(":") + 1);
  // A show's soonest future date on the calendar (collectMonth dropped past
  // ones), used to fetch detail pages cheapest-first.
  const earliestOf = (s: Discovered) => [...s.dates].sort()[0] ?? "9999-99-99";

  // Fetch show pages soonest-first so a busy multi-month calendar doesn't pull
  // every show's detail page when only `maxItems` are kept. Stop once we hold
  // `maxItems` items strictly sooner than the next show's earliest date: every
  // remaining show starts on or after that date, so none can displace them.
  const shows = [...byHref.values()].sort((a, b) => earliestOf(a).localeCompare(earliestOf(b)));

  for (const show of shows) {
    const earliest = earliestOf(show);
    if (limit && out.filter((r) => dateOf(r) < earliest).length >= limit) break;

    const detailUrl = abs(origin, show.href);
    let detail: ShowDetail | null = null;
    try {
      detail = parseShowDetail(await fetchHtml(detailUrl), origin);
    } catch (err) {
      // A single unparseable show page falls back to calendar-only data below.
      console.error(`[comedyWorksCalendar] detail fetch failed for ${detailUrl}`, err);
    }

    const slug = show.href.split("/").filter(Boolean).pop() ?? show.href;

    // Prefer the show page's per-club showtimes, keeping only this source's club
    // (a comedian booked at both clubs has a section for each). Fall back to the
    // calendar dates — already club-filtered at discovery — when the page didn't
    // parse or has no matching showtimes.
    const emits: Array<{ date: string; times: string[]; venueName: string | null; address: string | null }> = [];
    for (const sec of detail?.sections ?? []) {
      if (source.comedyWorksClub && sec.club !== source.comedyWorksClub) continue;
      for (const [date, times] of sec.timesByDate) {
        emits.push({ date, times, venueName: sec.venueName, address: sec.address });
      }
    }
    if (!emits.length) {
      for (const date of show.dates) {
        emits.push({ date, times: [], venueName: show.location, address: null });
      }
    }

    for (const e of emits) {
      if (e.date < today) continue; // drop the show page's past showtimes
      const sourceId = `${source.id}:${slug}:${e.date}`;
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);

      const blob = [
        show.title,
        `Date: ${e.date}`,
        e.times.length ? `Showtimes: ${e.times.join(", ")}` : null,
        // Venue context for the LLM only — the source's defaultVenueSlug pins the
        // listing authoritatively, so this name never drives venue resolution.
        e.venueName ? `Venue: ${e.venueName}` : null,
        e.address ? `Address: ${e.address}` : null,
        detail?.price ? `Tickets: ${detail.price}` : null,
        detail?.description ? `About: ${detail.description}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      out.push({
        sourceId,
        sourceUrl: detailUrl,
        text: blob,
        imageUrl: detail?.imageUrl ?? undefined,
        fetchedAt,
        venueName: e.venueName ?? undefined,
        address: e.address ?? undefined,
      });
    }
  }

  // Soonest-first so maxItems yields the nearest window; weekly re-runs advance
  // it forward. (The early-stop above caps fetches but can over-collect by one
  // show, so the slice still trims to the soonest maxItems.)
  out.sort((a, b) => dateOf(a).localeCompare(dateOf(b)) || a.sourceId.localeCompare(b.sourceId));
  return limit ? out.slice(0, limit) : out;
}
