import type { Listing } from "@/lib/types";
import { denverDayKey, denverStartOfTodayMs, isSingleDayDisplay } from "@/lib/dates";

// A listing is "past" once its effective end (date_end, falling back to
// date_start) is before the start of today. Undated listings (perpetual deals)
// are never past. Shared by the venue page and the Saved Events panel.
export function isPastListing(
  listing: Pick<Listing, "startAt" | "endAt">,
  now: Date = new Date(),
): boolean {
  const end = listing.endAt ?? listing.startAt;
  if (!end) return false;
  const t = Date.parse(end);
  if (Number.isNaN(t)) return false;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return t < startOfToday.getTime();
}

// A card whose date_display names a SINGLE calendar day that is already past
// (Denver). Unlike isPastListing, this ignores date_end: a recurring deal carries
// a rolling future date_end that keeps it in the feed window even when its
// date_start/date_display point at a stale past occurrence ("Thu, Jul 2"). Those
// single-day-but-past cards must not surface. Cadence cards ("Every Thursday") and
// ongoing ranges ("May 14 - Sep 7") aren't single-day displays, so they're kept.
export function isPastSpecificDateCard(
  listing: Pick<Listing, "dateDisplay" | "startAt">,
  now: number = Date.now(),
): boolean {
  if (!isSingleDayDisplay(listing.dateDisplay ?? "")) return false;
  if (!listing.startAt) return false;
  const t = Date.parse(listing.startAt);
  if (Number.isNaN(t)) return false;
  return denverDayKey(t) < denverDayKey(denverStartOfTodayMs(now));
}
