import type { ListingInsert, NormalizedListing } from "./types";
import { eventKey, makeSlug } from "./dedup";

// Splits a recurring WEEKLY event (a market posted as "Every Sunday May 10 –
// Oct 25") into one listing per upcoming occurrence — each a specific day + time
// — so listings carry a concrete date users can favorite, and a long range no
// longer camps at the top of the date-sorted feed. Continuous fixed-end runs and
// recurring DEALS are left untouched (deals keep persist.ts's rolling window).

const DAY = 86400000;
const DENVER = "America/Denver";
const OCCURRENCE_WINDOW_DAYS = 56; // ~8 weeks forward
const MAX_OCCURRENCES = 8;

const WEEKDAY_NUM: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

// Weekday(s) named in a recurrence label ("Every Sunday", "Tuesdays",
// "Tue & Thu"). Returns the set of 0–6 (Sun–Sat) day numbers, empty when none —
// the caller only reaches here for `recurring` rows, so a specific-date display
// ("Sun, Jul 5") never lands here.
export function parseWeekdays(text: string): Set<number> {
  const s = (text ?? "").toLowerCase();
  const days = new Set<number>();
  for (const [name, num] of Object.entries(WEEKDAY_NUM)) {
    if (new RegExp(`\\b${name}s?\\b`).test(s) || new RegExp(`\\b${name.slice(0, 3)}\\b`).test(s)) {
      days.add(num);
    }
  }
  return days;
}

// Minutes-since-midnight for the start and (optional) end of a time label
// ("9:00 AM – 1:00 PM" → {start: 540, end: 780}; "5:00 PM" → {start: 1020}).
function parseTimeRange(text: string): { start: number | null; end: number | null } {
  const matches = [...(text ?? "").matchAll(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?/gi)];
  const toMin = (m: RegExpMatchArray) =>
    ((parseInt(m[1], 10) % 12) + (/p/i.test(m[3]) ? 12 : 0)) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
  if (matches.length === 0) return { start: null, end: null };
  return { start: toMin(matches[0]), end: matches[1] ? toMin(matches[1]) : null };
}

// Denver-local weekday number of an instant (DST-correct via Intl), so an
// evening event whose UTC date_start has rolled to the next calendar day is
// still placed on its real local weekday.
function denverWeekdayNum(ms: number): number {
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: DENVER })
    .format(new Date(ms))
    .toLowerCase();
  return WEEKDAY_NUM[wd] ?? new Date(ms).getUTCDay();
}

// "Sun, Jul 5" — the human day label shown on the card.
function denverDayLabel(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: DENVER,
  }).format(new Date(ms));
}

// "2026-07-05" — stable per-occurrence key (Denver-local day).
function denverDayKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: DENVER,
  }).format(new Date(ms));
}

// Build one occurrence row from the base, on the instant `ms` (which already
// carries the series' start time-of-day, so only the day changes).
function makeOccurrence(
  base: ListingInsert,
  norm: NormalizedListing,
  ms: number,
  durationMs: number | null,
  dayKey: string,
): ListingInsert {
  const iso = new Date(ms).toISOString();
  const sourceId = `${base.source_id}#${dayKey}`;
  return {
    ...base,
    date_start: iso,
    date_end: durationMs != null ? new Date(ms + durationMs).toISOString() : null,
    date_display: denverDayLabel(ms),
    source_id: sourceId,
    slug: makeSlug(base.title, `${base.source}:${sourceId}`),
    // Key on the SPECIFIC day (base recurring rows key on day:null) so each
    // occurrence is distinct yet still dedupes same-day cross-source posts.
    event_key: eventKey({
      canonicalTitle: norm.canonicalTitle,
      venueId: base.venue_id,
      dateStart: iso,
    }),
  };
}

// Anchor on the base's already-resolved first-occurrence instant and step
// forward in whole days, emitting an occurrence on each matching weekday within
// the rolling window (capped). Whole-day stepping preserves the start
// time-of-day; the day advances correctly across DST.
function generateOccurrences(
  base: ListingInsert,
  norm: NormalizedListing,
  weekdays: Set<number>,
  now: number,
): ListingInsert[] {
  const todayKey = denverDayKey(now);
  // Step from TODAY (or the series' first day if it's still upcoming) rather than
  // the stored anchor — date_start is often the series START (months ago) and may
  // be a bare midnight-UTC date whose Denver day is off by one. Anchoring each
  // step at 18:00Z (midday Denver) keeps the UTC day equal to the local day, so
  // day labels, the feed cutoff, and the day-keyed event_key all agree across DST.
  const anchor = base.date_start ? Date.parse(base.date_start) : NaN;
  const startKey = !Number.isNaN(anchor) && anchor > now ? denverDayKey(anchor) : todayKey;
  const startMs = Date.parse(`${startKey}T18:00:00Z`);
  const startDow = denverWeekdayNum(startMs);

  let endMs = now + OCCURRENCE_WINDOW_DAYS * DAY;
  const seriesEnd = norm.dateEnd ? Date.parse(norm.dateEnd) : NaN;
  // Cap to a real series end only when it falls within the window and is still
  // ahead — a stale/past end means the series rolls on. Compared at DAY
  // granularity so the final day's occurrence isn't dropped by an end timestamp
  // that falls earlier that same day.
  if (!Number.isNaN(seriesEnd) && seriesEnd > now && seriesEnd < endMs) endMs = seriesEnd;
  const endDayKey = denverDayKey(endMs);

  const time = parseTimeRange(base.time_display ?? "");
  const durationMs =
    time.start != null && time.end != null && time.end > time.start
      ? (time.end - time.start) * 60000
      : null;

  const occurrences: ListingInsert[] = [];
  for (let off = 0; off < 400 && occurrences.length < MAX_OCCURRENCES; off++) {
    const ms = startMs + off * DAY;
    const dayKey = denverDayKey(ms);
    if (dayKey > endDayKey) break; // past the (inclusive) end day
    if (!weekdays.has((startDow + off) % 7)) continue;
    occurrences.push(makeOccurrence(base, norm, ms, durationMs, dayKey));
  }
  return occurrences;
}

// Replace each recurring WEEKLY EVENT row with its upcoming occurrences. Rows
// pass through unchanged when not recurring, not an event (deals keep the
// rolling window), have no parseable weekday, or yield no occurrence.
export function expandRecurringOccurrences(
  rows: ListingInsert[],
  normalizedBySourceId: Map<string, NormalizedListing>,
  now: number = Date.now(),
): ListingInsert[] {
  const out: ListingInsert[] = [];
  for (const row of rows) {
    const norm = normalizedBySourceId.get(row.source_id);
    if (norm?.recurring && norm.type === "event") {
      const weekdays = parseWeekdays(row.date_display ?? norm.dateDisplay ?? "");
      if (weekdays.size > 0) {
        const occ = generateOccurrences(row, norm, weekdays, now);
        if (occ.length > 0) {
          out.push(...occ);
          continue;
        }
      }
    }
    out.push(row);
  }
  return out;
}
