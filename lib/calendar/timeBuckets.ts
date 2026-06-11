import type { Listing } from "@/lib/types";

// Time-of-day breakout used by the calendar's day and week views.
export type TimeBucket = "morning" | "afternoon" | "evening" | "allday";

export const TIME_BUCKETS: { id: TimeBucket; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "allday", label: "All day" },
];

// Pull the start hour (0-23) out of a time_display string ("4:00 PM",
// "9:00 AM - 1:00 PM", "Golden hour (approx. 8:30 PM)"). Returns null when there's
// no AM/PM clock time ("All day", "Times vary", null).
function startHourFromDisplay(timeDisplay: string | null | undefined): number | null {
  if (!timeDisplay) return null;
  const m = /(\d{1,2})(?::\d{2})?\s*([ap])\.?\s*m\.?/i.exec(timeDisplay);
  if (!m) return null;
  const h = parseInt(m[1], 10) % 12;
  return /p/i.test(m[2]) ? h + 12 : h;
}

// Bucket a listing by its wall-clock start hour. We read it from time_display —
// the string the user actually sees — rather than date_start, whose timezone
// convention is inconsistent across sources (most store the venue wall-clock
// labeled UTC, a few store true UTC), so no single hour-read of date_start is
// correct for all. No parseable time ("All day", "Times vary", none) → All day.
export function timeBucketOf(listing: Pick<Listing, "timeDisplay">): TimeBucket {
  const h = startHourFromDisplay(listing.timeDisplay);
  if (h === null) return "allday";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// Group listings into time buckets, preserving input order within each bucket.
export function groupByTimeBucket<T extends Pick<Listing, "timeDisplay">>(
  listings: readonly T[],
): Record<TimeBucket, T[]> {
  const groups: Record<TimeBucket, T[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    allday: [],
  };
  for (const l of listings) groups[timeBucketOf(l)].push(l);
  return groups;
}
