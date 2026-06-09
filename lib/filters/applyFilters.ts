import type { Filters, Listing } from "@/lib/types";
import {
  neighborhoodLabel,
  neighborhoodSlug,
} from "@/lib/data/neighborhoods";
import { locationMatchesSelection } from "@/lib/data/locations";
import { categoryLabel, categorySlug } from "@/lib/data/categories";

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

function getDateRange(
  filters: Filters,
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
export function sortListings(listings: Listing[], sort: Filters["sort"]): Listing[] {
  const time = (l: Listing) => {
    const t = l.startAt ? Date.parse(l.startAt) : NaN;
    return Number.isNaN(t) ? null : t;
  };
  // Date comparator; undated listings always sort last, both directions.
  const byDate = (a: Listing, b: Listing, latest: boolean) => {
    const ta = time(a);
    const tb = time(b);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return latest ? tb - ta : ta - tb;
  };
  const bySoonest = (a: Listing, b: Listing) => byDate(a, b, false);
  // Grouping sorts: rank desc (higher first), then soonest as the tiebreaker.
  const grouped = (rankOf: (l: Listing) => number) => (a: Listing, b: Listing) =>
    rankOf(b) - rankOf(a) || bySoonest(a, b);

  const comparators: Record<Filters["sort"], (a: Listing, b: Listing) => number> = {
    soonest: bySoonest,
    latest: (a, b) => byDate(a, b, true),
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
