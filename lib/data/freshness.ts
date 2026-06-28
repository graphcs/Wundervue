// Event "freshness" = when a listing — or its recurring SERIES — was FIRST seen
// by the ingest pipeline. Powers the NEW badge + the "New this week" rail.
//
// The key subtlety: the recurring-split (lib/ingest/expandOccurrences.ts) inserts
// new FUTURE occurrence rows each week as the rolling window advances, so a
// long-running weekly series would perpetually re-enter "new" if we keyed on each
// row's own created_at. We instead group every occurrence of a series under one
// key and take the EARLIEST created_at as the series' first-seen.

export const NEW_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

// Occurrence rows carry a `#YYYY-MM-DD` suffix on their source_id; strip it so all
// dates of a series collapse to one key. Non-occurrence rows are unaffected.
export function seriesBaseKey(source: string, sourceId: string): string {
  return `${source}:${sourceId.replace(/#\d{4}-\d{2}-\d{2}$/, "")}`;
}

// source/source_id/created_at rows → series base key → earliest created_at (ISO).
export function seriesFirstSeen(
  rows: Array<{ source: string; source_id: string | null; created_at: string | null }>,
): Map<string, string> {
  const min = new Map<string, string>();
  for (const r of rows) {
    if (!r.source_id || !r.created_at) continue;
    const key = seriesBaseKey(r.source, r.source_id);
    const cur = min.get(key);
    // ISO-8601 strings compare lexicographically in chronological order.
    if (!cur || r.created_at < cur) min.set(key, r.created_at);
  }
  return min;
}

export function isFresh(firstSeenAt: string | undefined | null, now: number = Date.now()): boolean {
  if (!firstSeenAt) return false;
  const t = Date.parse(firstSeenAt);
  return Number.isFinite(t) && now - t < NEW_WINDOW_DAYS * DAY_MS;
}
