import type { Listing } from "@/lib/types";

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
