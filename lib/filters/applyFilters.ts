import type { Filters, Listing } from "@/lib/types";
import {
  neighborhoodLabel,
  neighborhoodSlug,
} from "@/lib/data/neighborhoods";
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

  return listings.filter((l) => {
    if (filters.type === "events" && l.type !== "event" && l.type !== "both")
      return false;
    if (filters.type === "deals" && l.type !== "deal" && l.type !== "both")
      return false;
    if (filters.type === "both" && l.type !== "both") return false;

    if (hoods.size) {
      const slug = neighborhoodSlug(l.neighborhood);
      if (!slug || !hoods.has(slug)) return false;
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
}

export { neighborhoodLabel, neighborhoodSlug, categoryLabel, categorySlug };
