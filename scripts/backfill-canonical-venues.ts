#!/usr/bin/env tsx
/**
 * One-shot backfill: when a canonical listing has venue_id=null but its
 * dedup_of-children carry a resolved venue (because they were ingested AFTER
 * the venue-extraction pipeline went live), copy the venue down onto the
 * canonical so the explore detail page shows it.
 *
 * Why this exists: classifyForUpsert chose first-write-wins for cross-source
 * duplicates. Pre-pipeline rows became canonicals; post-pipeline rows with
 * better venue data got hidden as duplicates. Promoting the better data is
 * cleaner than swapping which row is canonical.
 */
import { getServiceClient } from "@/lib/ingest/persist";

interface Row {
  id: string;
  slug: string;
  title: string;
  venue_id: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  dedup_of: string | null;
  published_at: string | null;
}

async function main() {
  const c = getServiceClient();

  // Pull canonicals (visible rows) that lack a venue.
  const { data: canonicals, error: e1 } = await c
    .from("listings")
    .select("id, slug, title, venue_id, address, lat, lng, dedup_of, published_at")
    .is("venue_id", null)
    .not("published_at", "is", null);
  if (e1) throw new Error(`canonical query failed: ${e1.message}`);
  const list = (canonicals ?? []) as Row[];
  console.log(`canonicals missing venue: ${list.length}`);

  let updated = 0;
  let skipped = 0;
  for (const can of list) {
    // Look for any duplicate that points at this canonical and has a venue.
    const { data: dupes } = await c
      .from("listings")
      .select("id, slug, title, venue_id, address, lat, lng, dedup_of, published_at")
      .eq("dedup_of", can.id)
      .not("venue_id", "is", null)
      .limit(1);
    const donor = (dupes?.[0] as Row | undefined) ?? undefined;
    if (!donor) {
      skipped++;
      continue;
    }
    const { error: e2 } = await c
      .from("listings")
      .update({
        venue_id: donor.venue_id,
        address: donor.address,
        lat: donor.lat,
        lng: donor.lng,
      })
      .eq("id", can.id);
    if (e2) {
      console.error(`update failed for ${can.slug}: ${e2.message}`);
      continue;
    }
    updated++;
    console.log(
      `[backfill] ${can.slug} ← donor venue_id=${donor.venue_id} (${donor.slug})`,
    );
  }
  console.log(`done: ${updated} updated, ${skipped} skipped (no donor)`);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
