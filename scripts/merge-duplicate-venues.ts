#!/usr/bin/env tsx
/**
 * One-off backfill: merge venue rows that represent the same place under
 * different names/slugs (e.g. "little-blue-pigeon" + "little-blue-pigeon-books").
 * Groups venues by canonicalKey(), picks a canonical row per group, repoints all
 * listings (and venue_follows) onto it, deletes the duplicates, then re-runs the
 * venue-title dedup so cross-source copies now sharing a venue collapse.
 *
 * Usage:
 *   tsx scripts/merge-duplicate-venues.mts          # apply
 *   tsx scripts/merge-duplicate-venues.mts --dry    # report only, no writes
 */
import { getServiceClient } from "@/lib/ingest/persist";
import { canonicalKey } from "@/lib/ingest/venueCanonical";
import { mergeVenueTitleDuplicatesForVenues } from "@/lib/ingest/dedupCluster";

interface VenueRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
}

const dryRun = process.argv.includes("--dry");

function pickCanonical(group: VenueRow[], counts: Map<string, number>): VenueRow {
  // Prefer a seeded/curated row (non-empty description), then the most-used
  // venue, then the earliest created.
  return [...group].sort((a, b) => {
    const da = a.description?.trim() ? 0 : 1;
    const db = b.description?.trim() ? 0 : 1;
    if (da !== db) return da - db;
    const ca = counts.get(a.id) ?? 0;
    const cb = counts.get(b.id) ?? 0;
    if (ca !== cb) return cb - ca;
    return Date.parse(a.created_at) - Date.parse(b.created_at);
  })[0];
}

async function main() {
  const sb = getServiceClient();

  const { data: venues, error } = await sb
    .from("venues")
    .select("id, slug, name, description, created_at");
  if (error) throw new Error(`load venues: ${error.message}`);
  const rows = (venues ?? []) as VenueRow[];

  // Listing counts per venue (for canonical selection).
  const counts = new Map<string, number>();
  {
    let from = 0;
    for (;;) {
      const { data, error: e } = await sb
        .from("listings")
        .select("venue_id")
        .not("venue_id", "is", null)
        .range(from, from + 999);
      if (e) throw new Error(`load listings: ${e.message}`);
      if (!data?.length) break;
      for (const r of data as Array<{ venue_id: string }>) {
        counts.set(r.venue_id, (counts.get(r.venue_id) ?? 0) + 1);
      }
      from += 1000;
      if (data.length < 1000) break;
    }
  }

  // Group by canonical key.
  const groups = new Map<string, VenueRow[]>();
  for (const v of rows) {
    const key = canonicalKey(v.name);
    if (!key) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(v);
  }

  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  console.log(`venues: ${rows.length} | duplicate groups: ${dupGroups.length}`);

  const touchedCanonicalIds: string[] = [];
  let mergedVenues = 0;
  let repointedListings = 0;

  for (const group of dupGroups) {
    const canonical = pickCanonical(group, counts);
    const dups = group.filter((v) => v.id !== canonical.id);
    console.log(
      `\n[${canonicalKey(canonical.name)}] canonical=${canonical.slug} (${counts.get(canonical.id) ?? 0} listings)` +
        ` <- ${dups.map((d) => `${d.slug}(${counts.get(d.id) ?? 0})`).join(", ")}`,
    );
    if (dryRun) continue;

    for (const dup of dups) {
      const up = await sb
        .from("listings")
        .update({ venue_id: canonical.id })
        .eq("venue_id", dup.id)
        .select("id");
      if (up.error) throw new Error(`repoint listings (${dup.slug}): ${up.error.message}`);
      repointedListings += up.data?.length ?? 0;

      // Best-effort: move follows to the canonical slug; ignore unique conflicts.
      await sb
        .from("venue_follows")
        .update({ venue_slug: canonical.slug })
        .eq("venue_slug", dup.slug);

      const del = await sb.from("venues").delete().eq("id", dup.id);
      if (del.error) throw new Error(`delete venue ${dup.slug}: ${del.error.message}`);
      mergedVenues++;
    }
    touchedCanonicalIds.push(canonical.id);
  }

  if (!dryRun && touchedCanonicalIds.length) {
    const res = await mergeVenueTitleDuplicatesForVenues(touchedCanonicalIds);
    console.log(
      `\nmerged ${mergedVenues} duplicate venues, repointed ${repointedListings} listings;` +
        ` post-merge title dedup marked ${res.markedDuplicate}.`,
    );
  } else if (dryRun) {
    console.log("\n(dry run — no changes written)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
