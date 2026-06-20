/**
 * Re-resolve region_slug / city_slug / neighborhood_slug (and the neighborhood
 * label) on venues + listings using the venue/listing ADDRESS as the
 * authoritative city signal, instead of the unreliable free-text neighborhood
 * label (which stamped "Golden" on Boulder/Littleton/Morrison/etc. rows).
 *
 * Precedence lives in lib/ingest/persist.ts (resolveLocationSlugsSync):
 *   venue-name alias (Red Rocks → Morrison) > Central-Denver neighborhood label
 *   > city parsed from the address > any other label match.
 *
 * Venues run first; listings then inherit their corrected venue's slugs (or
 * resolve from their own address when they have no venue). Idempotent.
 *
 * Usage: tsx scripts/backfill-city-from-address.mts [--apply] [--geocode]
 *   dry-run by default; --apply writes; --geocode adds a reverse-geocode pass
 *   for rows that don't resolve from text but have coords (slower, hits OSM).
 */
import { createClient } from "@supabase/supabase-js";
import type { ResolvedLocation } from "@/lib/ingest/persist";
// tsx transpiles these lib modules to CJS, so their named value-exports land
// under `.default` — a plain `import { x }` throws "no export named x" at runtime.
import * as locationsNs from "@/lib/data/locations";
import * as persistNs from "@/lib/ingest/persist";
const { extractAddressCity } =
  (locationsNs as { default?: typeof locationsNs }).default ?? locationsNs;
const { resolveLocationSlugs, resolveLocationSlugsSync } =
  (persistNs as { default?: typeof persistNs }).default ?? persistNs;

const APPLY = process.argv.includes("--apply");
const GEOCODE = process.argv.includes("--geocode");

const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

interface VenueRow {
  id: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  region_slug: string | null;
  city_slug: string | null;
  neighborhood_slug: string | null;
  lat: number | null;
  lng: number | null;
}

function changed(
  next: ResolvedLocation,
  row: Pick<VenueRow, "region_slug" | "city_slug" | "neighborhood_slug" | "neighborhood">,
): boolean {
  return (
    next.region_slug !== row.region_slug ||
    next.city_slug !== row.city_slug ||
    next.neighborhood_slug !== row.neighborhood_slug ||
    (next.neighborhood ?? "") !== (row.neighborhood ?? "")
  );
}

// venueId -> the venue's final (corrected) slugs + label, for listing propagation.
const venueFinal = new Map<string, ResolvedLocation>();

async function backfillVenues() {
  const { data, error } = await c
    .from("venues")
    .select("id, name, address, neighborhood, region_slug, city_slug, neighborhood_slug, lat, lng");
  if (error) throw new Error(`venues lookup failed: ${error.message}`);

  let updated = 0;
  const toAdd = new Map<string, number>(); // in-metro-ish city string -> count

  for (const v of (data ?? []) as VenueRow[]) {
    const next = GEOCODE
      ? await resolveLocationSlugs({
          neighborhood: v.neighborhood,
          address: v.address,
          venueName: v.name,
          lat: v.lat,
          lng: v.lng,
        })
      : resolveLocationSlugsSync({
          neighborhood: v.neighborhood,
          address: v.address,
          venueName: v.name,
        });
    venueFinal.set(v.id, next);

    if (!next.city_slug && !next.region_slug) {
      const rc = extractAddressCity(v.address);
      if (rc) toAdd.set(rc, (toAdd.get(rc) ?? 0) + 1);
    }
    if (!changed(next, v)) continue;
    if (APPLY) {
      const { error: upErr } = await c
        .from("venues")
        .update({
          neighborhood: next.neighborhood ?? "",
          region_slug: next.region_slug,
          city_slug: next.city_slug,
          neighborhood_slug: next.neighborhood_slug,
        })
        .eq("id", v.id);
      if (upErr) {
        console.error(`  venue update failed for ${v.id}: ${upErr.message}`);
        continue;
      }
    }
    updated++;
  }

  console.log(`[venues] ${APPLY ? "updated" : "would update"} ${updated} rows`);
  if (toAdd.size > 0) {
    console.log("  unresolved address-cities (review — add real metro cities to the taxonomy):");
    for (const [city, n] of [...toAdd.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(3)}  ${city}`);
    }
  }
}

async function backfillListings() {
  const { data, error } = await c
    .from("listings")
    .select("id, venue_id, address, neighborhood, region_slug, city_slug, neighborhood_slug");
  if (error) throw new Error(`listings lookup failed: ${error.message}`);

  let updated = 0;
  for (const l of (data ?? []) as Array<{
    id: string;
    venue_id: string | null;
    address: string | null;
    neighborhood: string | null;
    region_slug: string | null;
    city_slug: string | null;
    neighborhood_slug: string | null;
  }>) {
    // A listing with a venue inherits the venue's corrected slugs+label;
    // otherwise resolve from the listing's own address.
    const next: ResolvedLocation =
      (l.venue_id && venueFinal.get(l.venue_id)) ||
      resolveLocationSlugsSync({
        neighborhood: l.neighborhood,
        address: l.address,
        venueName: null,
      });

    if (!changed(next, l)) continue;
    if (APPLY) {
      const { error: upErr } = await c
        .from("listings")
        .update({
          neighborhood: next.neighborhood ?? "",
          region_slug: next.region_slug,
          city_slug: next.city_slug,
          neighborhood_slug: next.neighborhood_slug,
        })
        .eq("id", l.id);
      if (upErr) {
        console.error(`  listing update failed for ${l.id}: ${upErr.message}`);
        continue;
      }
    }
    updated++;
  }
  console.log(`[listings] ${APPLY ? "updated" : "would update"} ${updated} rows`);
}

console.log(
  `${APPLY ? "Applying" : "Dry run —"} city-from-address backfill${GEOCODE ? " (with reverse-geocode)" : ""}…`,
);
await backfillVenues();
await backfillListings();
console.log("Done.");
