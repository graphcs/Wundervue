import type { Filters, Listing } from "@/lib/types";
import {
  neighborhoodLabel,
  neighborhoodSlug,
} from "@/lib/data/neighborhoods";
import { locationMatchesSelection } from "@/lib/data/locations";
import { categoryLabel, categorySlug } from "@/lib/data/categories";
import { DAY_MS, RECUR_RE, denverDayKey, denverWeekdayNum, denverStartOfTodayMs } from "@/lib/dates";

// A recurring listing's date_display is a CADENCE ("Every Thursday"), and an
// un-split recurring deal carries a rolling "today" date_start — so it must sort to
// its NEXT occurrence of that weekday, not to today. A specific-date row ("Thu, Jul
// 2") has no cadence words and keeps its real date (returns null here). RECUR_RE is
// shared with the feed filter + is_past sweep (see lib/dates.ts).
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function nextRecurringDayKey(disp: string, todayMs: number): string | null {
  if (!RECUR_RE.test(disp)) return null;
  const low = disp.toLowerCase();
  const todayDow = denverWeekdayNum(todayMs);
  let best: number | null = null;
  DAY_NAMES.forEach((name, wd) => {
    if (!low.includes(name)) return;
    const ms = todayMs + ((wd - todayDow + 7) % 7) * DAY_MS; // next such weekday (today if it matches)
    if (best === null || ms < best) best = ms;
  });
  return best === null ? null : denverDayKey(best);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// Resolve a date preset (or custom from/to) into a concrete [start, end] window.
// Exported so the venue browse pipeline can apply the exact same "time" filter
// as the explore feed. Only reads date/from/to, so callers can pass a slim object.
export function getDateRange(
  filters: Pick<Filters, "date" | "from" | "to">,
  now: Date = new Date(),
): { start: Date; end: Date } | null {
  const today = startOfDay(now);
  switch (filters.date) {
    case "today":
      return { start: today, end: endOfDay(now) };
    case "this-weekend": {
      const day = now.getDay();
      const daysUntilSat = (6 - day + 7) % 7;
      const sat = startOfDay(new Date(today.getTime() + daysUntilSat * 86400000));
      const sun = endOfDay(new Date(sat.getTime() + 86400000));
      return { start: sat, end: sun };
    }
    case "this-week": {
      const day = now.getDay();
      const daysUntilSun = 6 - day;
      return {
        start: today,
        end: endOfDay(new Date(today.getTime() + daysUntilSun * 86400000)),
      };
    }
    case "this-month": {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: today, end };
    }
    case "next-month": {
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case "custom": {
      if (!filters.from && !filters.to) return null;
      const start = filters.from ? startOfDay(new Date(filters.from)) : today;
      const end = filters.to
        ? endOfDay(new Date(filters.to))
        : endOfDay(new Date(2099, 0, 1));
      return { start, end };
    }
    default:
      return null;
  }
}

// Sort a filtered list by the user's chosen ordering. Listings without a
// start time sort last regardless of direction (they have no place on a
// soonest/latest timeline). For the non-date sorts (free/deals/most-saved),
// "soonest" is the tiebreaker within each group.
export function sortListings(
  listings: Listing[],
  sort: Filters["sort"],
  now: number = Date.now(),
): Listing[] {
  const todayMs = denverStartOfTodayMs(now);
  const todayKey = denverDayKey(todayMs);
  const UNDATED = "9999-99-99"; // sorts after any real "2026-.." day → undated rows last

  // Precompute each listing's sort keys ONCE — the comparator runs O(n log n) times,
  // so parsing dates / regexes / Intl inside it would be wasteful.
  interface SortKey { day: string; isNew: boolean; start: number; first: number }
  const keys = new Map<Listing, SortKey>();
  for (const l of listings) {
    const t = l.startAt ? Date.parse(l.startAt) : NaN;
    let day: string;
    if (Number.isNaN(t)) {
      day = UNDATED;
    } else {
      // EFFECTIVE Denver day = max(start day, today): a still-running range sorts as
      // today (not its old start); a cadence ("Every Thursday") sorts to its next
      // occurrence. Denver-day, matching the feed cutoff, so evening events don't
      // bucket a day late.
      const recur = nextRecurringDayKey(l.dateDisplay ?? "", todayMs);
      const startKey = denverDayKey(t);
      day = recur ?? (startKey > todayKey ? startKey : todayKey);
    }
    keys.set(l, {
      day,
      isNew: Boolean(l.isNew),
      start: Number.isNaN(t) ? Infinity : t,
      first: l.firstSeenAt ? Date.parse(l.firstSeenAt) : NaN,
    });
  }
  const k = (l: Listing) => keys.get(l)!;

  // Default browse = "soonest, but new first": soonest Denver day, then newly-scraped
  // (last-7-day) events ahead of older ones within that day, then by start time.
  const bySoonest = (a: Listing, b: Listing) => {
    const ka = k(a), kb = k(b);
    if (ka.day !== kb.day) return ka.day < kb.day ? -1 : 1;
    return Number(kb.isNew) - Number(ka.isNew) || ka.start - kb.start;
  };
  // Grouping sorts: rank desc (higher first), then soonest as the tiebreaker.
  const grouped = (rankOf: (l: Listing) => number) => (a: Listing, b: Listing) =>
    rankOf(b) - rankOf(a) || bySoonest(a, b);

  // Most-recently first-seen first (the "what's new" browse); rows without a
  // firstSeenAt (fixtures) sort last, then by soonest.
  const byNewest = (a: Listing, b: Listing) => {
    const fa = k(a).first, fb = k(b).first;
    const na = Number.isNaN(fa), nb = Number.isNaN(fb);
    if (na && nb) return bySoonest(a, b);
    if (na) return 1;
    if (nb) return -1;
    return fb - fa || bySoonest(a, b);
  };
  // Latest = real start time descending; undated last.
  const byLatest = (a: Listing, b: Listing) => {
    const sa = k(a).start, sb = k(b).start;
    if (sa === Infinity && sb === Infinity) return 0;
    if (sa === Infinity) return 1;
    if (sb === Infinity) return -1;
    return sb - sa;
  };

  const comparators: Record<Filters["sort"], (a: Listing, b: Listing) => number> = {
    soonest: bySoonest,
    newest: byNewest,
    latest: byLatest,
    "free-first": grouped((l) => (l.isFree ? 1 : 0)),
    // Deal-type listings first (matches the Deals filter + the badges) — an
    // event that merely carries a deal_value string is NOT a deal.
    "deals-first": grouped((l) => (l.type === "deal" || l.type === "both" ? 1 : 0)),
    "most-saved": grouped((l) => l.saveCount ?? 0),
  };
  return [...listings].sort(comparators[sort]);
}

export function applyFilters(
  listings: Listing[],
  filters: Filters,
  now: Date = new Date(),
): Listing[] {
  const dateRange = getDateRange(filters, now);
  const hoods = new Set(filters.neighborhoods);
  const cats = new Set(filters.categories);
  const tags = new Set(filters.lifestyle);
  const q = filters.q?.trim().toLowerCase();

  const matched = listings.filter((l) => {
    if (filters.type === "events" && l.type !== "event" && l.type !== "both")
      return false;
    if (filters.type === "deals" && l.type !== "deal" && l.type !== "both")
      return false;
    if (filters.type === "both" && l.type !== "both") return false;

    // Hierarchical location match: a selected region/city slug also matches
    // listings in its descendant neighborhoods (lib/data/locations.ts).
    if (hoods.size && !locationMatchesSelection(l.neighborhood, hoods)) {
      return false;
    }

    if (cats.size) {
      const slug = categorySlug(l.category);
      if (!slug || !cats.has(slug)) return false;
    }

    if (tags.size) {
      const hasMatch = l.tags.some((t) => tags.has(t));
      if (!hasMatch) return false;
    }

    if (filters.freeOnly && !l.isFree) return false;

    if (filters.venue && l.venueId !== filters.venue) return false;

    if (dateRange) {
      const start = new Date(l.startAt);
      const end = l.endAt ? new Date(l.endAt) : start;
      const overlaps = end >= dateRange.start && start <= dateRange.end;
      if (!overlaps) return false;
    }

    if (q) {
      const hay =
        `${l.title} ${l.description} ${l.venueName} ${l.neighborhood} ${l.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  return sortListings(matched, filters.sort);
}

export { neighborhoodLabel, neighborhoodSlug, categoryLabel, categorySlug };
