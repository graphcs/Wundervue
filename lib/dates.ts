// Denver-local date helpers, shared by the ingest occurrence-splitter, the feed
// cutoff, and the feed sort — so "today in Denver" and "which Denver day" mean the
// same thing everywhere (a UTC-day shortcut put evening events on the wrong day).
// Pure (Intl only), so it's safe in both the server and client bundles. The
// Intl.DateTimeFormat instances are module-level: constructing them is expensive,
// and these run once per listing on the feed.

const DENVER = "America/Denver";
export const DAY_MS = 86_400_000;

export const WEEKDAY_NUM: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: DENVER,
});
const dayLabelFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short", month: "short", day: "numeric", timeZone: DENVER,
});
const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: DENVER });
const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: DENVER, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

// "2026-07-05" — the Denver calendar day of an instant (sorts chronologically as a string).
export function denverDayKey(ms: number): string {
  return dayKeyFmt.format(new Date(ms));
}

// "Sun, Jul 5" — the human day label shown on cards.
export function denverDayLabel(ms: number): string {
  return dayLabelFmt.format(new Date(ms));
}

// 0–6 (Sun–Sat) Denver weekday of an instant — DST-correct.
export function denverWeekdayNum(ms: number): number {
  return WEEKDAY_NUM[weekdayFmt.format(new Date(ms)).toLowerCase()] ?? new Date(ms).getUTCDay();
}

// Start of "today" in Denver as a UTC instant (ms). A bare UTC-midnight cutoff
// leaked last night's evening events (8 PM is already "tomorrow" in UTC).
export function denverStartOfTodayMs(now: number = Date.now()): number {
  const p = partsFmt
    .formatToParts(new Date(now))
    .reduce((a, x) => ((a[x.type] = x.value), a), {} as Record<string, string>);
  const hh = Number(p.hour) % 24; // some engines render midnight as "24"
  // Denver-local wall clock reinterpreted as a UTC instant → the offset to real UTC.
  const offsetMs = Date.UTC(+p.year, +p.month - 1, +p.day, hh, +p.minute, +p.second) - now;
  return Date.UTC(+p.year, +p.month - 1, +p.day, 0, 0, 0) - offsetMs;
}

export function denverStartOfTodayISO(now: number = Date.now()): string {
  return new Date(denverStartOfTodayMs(now)).toISOString();
}

// A recurring listing's date_display is a CADENCE ("Every Thursday") rather than a
// single specific day. Used by the sort to advance a cadence card to its next
// occurrence. Shared source of truth (see lib/filters/applyFilters.ts).
export const RECUR_RE = /\b(?:every|each|weekly)\b|\b(?:mon|tues|wednes|thurs|fri|satur|sun)days\b/i;

// Does a date_display name a SINGLE concrete calendar day ("Sun, Jul 5", "Jul 5")?
// This is exactly the shape denverDayLabel emits for one-off occurrences, so the
// whole string must be an optional weekday + month + day and nothing more. It
// deliberately does NOT match:
//   - cadences ("Every Thursday", "Weekends at 10 AM") — no month+day, and
//   - ranges / ongoing spans ("May 14 - Sep 7", "Through Sept. 7", "Sundays … through
//     Oct 25") — the trailing text fails the anchor.
// Positive, tight match keeps the feed filter conservative: we only hide a card when
// it advertises one specific day, and (per the caller) that day is already past —
// never an ongoing multi-week run whose display merely mentions a future end date.
export const SINGLE_DAY_DISPLAY_RE =
  /^(?:(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*,?\s*)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\s*$/i;
export function isSingleDayDisplay(disp: string): boolean {
  return SINGLE_DAY_DISPLAY_RE.test((disp ?? "").trim());
}
