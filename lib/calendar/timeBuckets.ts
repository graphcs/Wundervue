import type { Listing } from "@/lib/types";

// Time-of-day breakout used by the calendar's day and week views.
export type TimeBucket = "morning" | "afternoon" | "evening" | "allday";

export const TIME_BUCKETS: { id: TimeBucket; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "allday", label: "All day" },
];

// Bucket a listing by its local start hour. A start at exactly midnight is
// treated as date-only ("All day") rather than mis-filed under Morning, since
// listings with no known time land on 00:00.
export function timeBucketOf(listing: Pick<Listing, "startAt">): TimeBucket {
  if (!listing.startAt) return "allday";
  const d = new Date(listing.startAt);
  if (Number.isNaN(d.getTime())) return "allday";
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return "allday";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// Group listings into time buckets, preserving input order within each bucket.
export function groupByTimeBucket<T extends Pick<Listing, "startAt">>(
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
