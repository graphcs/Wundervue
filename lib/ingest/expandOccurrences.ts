import type { ListingInsert, NormalizedListing } from "./types";
import { eventKey, makeSlug } from "./dedup";
import { DAY_MS as DAY, WEEKDAY_NUM, denverDayKey, denverDayLabel, denverWeekdayNum } from "../dates";

// Splits multi-day listings into one row per upcoming day so every card carries a
// concrete date (favoritable, and no range camps at the top of the date-sorted feed):
//   - a recurring WEEKLY event ("Every Sunday May 10 – Oct 25") → one row per upcoming
//     weekday occurrence;
//   - a continuous multi-day run (a festival, an all-summer residency) → one row per
//     day it's on, from today forward.
// A RECURRING deal (weekly happy hour, perpetual offer) is left untouched — it keeps
// persist.ts's rolling card. But a limited-time WINDOWED deal ("Jun 6 – Jun 30" treat)
// splits per day like a continuous run. Single-day events and connector-pre-expanded
// instances are untouched.

const OCCURRENCE_WINDOW_DAYS = 56; // ~8 weeks forward
const MAX_OCCURRENCES = 8;
// Passed to generateOccurrences to step EVERY day (a continuous run), vs a weekly
// series' specific weekday set.
const EVERY_DAY = new Set([0, 1, 2, 3, 4, 5, 6]);

// A weekly cadence stated in the source text ("Weekly Thu", "every Thursday",
// "Thursdays") — a deterministic backstop for when the LLM sets recurring=false
// on a weekly listing because the widget also shows a specific next date.
const WEEKLY_TEXT_RE =
  /\b(?:every|each|weekly)\s+(?:on\s+)?(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*\b|\b(?:mon|tues|wednes|thurs|fri|satur|sun)days\b/i;

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
  // Cap to a real series end only when it's a genuine multi-week range — more than
  // a day past the anchor. A single-occurrence dateEnd (the LLM read "Weekly Thu"
  // as one-off, so dateEnd == that day) must NOT cap the series to one occurrence;
  // those roll on for the full window. Compared at DAY granularity so the final
  // day's occurrence isn't dropped by an end timestamp earlier that same day.
  const seriesSpansWeeks = !Number.isNaN(seriesEnd) && !Number.isNaN(anchor) && seriesEnd > anchor + DAY;
  if (seriesSpansWeeks && seriesEnd > now && seriesEnd < endMs) endMs = seriesEnd;
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

// Hours an event must span to count as a genuine multi-day run, so a late-night
// show (8 PM–1 AM) whose end merely rolls past midnight isn't split into two days.
const MULTI_DAY_MIN_MS = 20 * 3600 * 1000;

// A still-running/upcoming event that genuinely spans 2+ Denver days — a festival,
// an all-summer residency. A single-day event (or an overnight one under ~a day)
// is left alone.
function isMultiDayRun(row: ListingInsert, now: number): boolean {
  if (!row.date_start || !row.date_end) return false;
  const start = Date.parse(row.date_start);
  const end = Date.parse(row.date_end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < now) return false;
  if (end - start < MULTI_DAY_MIN_MS) return false;
  return denverDayKey(end) > denverDayKey(start);
}

// Replace each recurring WEEKLY EVENT row with its upcoming occurrences. Splits a
// recurring event (or event+deal "both") that names a weekday — a weekly
// "Thursday Poker Night" should appear once per week, not once. Pure DEALS are NOT
// split: a weekly happy hour / ladies-night discount is an ongoing offer, so it
// keeps its single rolling-window listing (splitting them floods the feed with one
// row per week). Rows also pass through when not recurring, when no weekday is
// named, or when no occurrence is generated.
export function expandRecurringOccurrences(
  rows: ListingInsert[],
  normalizedBySourceId: Map<string, NormalizedListing>,
  now: number = Date.now(),
): ListingInsert[] {
  const out: ListingInsert[] = [];
  for (const row of rows) {
    const norm = normalizedBySourceId.get(row.source_id);
    // Deals keep persist.ts's rolling window; connector-pre-expanded instances
    // (tribeEvents, localistEvents) assert recurring:false and are already
    // specific days — never re-split either.
    if (norm && norm.connectorRecurring !== false) {
      const isDeal = norm.type === "deal";
      // Weekly recurrence applies to EVENTS only ("Thursday Poker Night" → one card
      // per Thursday). A weekly DEAL ("Every Thursday") keeps its single rolling card.
      const weekly =
        !isDeal &&
        (Boolean(norm.recurring) ||
          WEEKLY_TEXT_RE.test(`${norm.title} ${norm.description} ${row.date_display ?? ""}`));
      const weekdays = parseWeekdays(row.date_display ?? norm.dateDisplay ?? "");
      if (weekly && weekdays.size > 0) {
        // Weekly series → one occurrence per named weekday.
        const occ = generateOccurrences(row, norm, weekdays, now);
        if (occ.length > 0) {
          out.push(...occ);
          continue;
        }
      } else if (isMultiDayRun(row, now) && !(isDeal && norm.recurring)) {
        // A multi-day range. If a weekday is named in the date label / title /
        // description, it's a WEEKLY series the LLM rendered as a range (e.g. Yoga
        // "Jul 11 – Aug 29" whose blurb says "Saturday morning") → split on that
        // day, not every day. Otherwise it's a continuous run → one card per day.
        const named = parseWeekdays(`${row.date_display ?? ""} ${norm.title} ${norm.description}`);
        const occ = generateOccurrences(row, norm, named.size > 0 ? named : EVERY_DAY, now);
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
