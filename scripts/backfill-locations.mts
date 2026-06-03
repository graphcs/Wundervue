/**
 * Backfill region_slug / city_slug / neighborhood_slug on listings + venues,
 * and location_slugs on profiles, from existing flat `neighborhood` strings.
 *
 * Idempotent: re-running only rewrites rows whose resolved slugs changed.
 * Resolution + legacy aliases live in lib/data/locations.ts.
 *
 * Usage: tsx scripts/backfill-locations.mts [--apply]
 *   (dry-run by default; pass --apply to write)
 */
import { createClient } from "@supabase/supabase-js";
import { ancestrySlugs, resolveLocationLabel } from "@/lib/data/locations";

const APPLY = process.argv.includes("--apply");

const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function resolveRow(neighborhood: string | null): {
  region_slug: string | null;
  city_slug: string | null;
  neighborhood_slug: string | null;
} {
  const ref = resolveLocationLabel(neighborhood);
  const a = ancestrySlugs(ref);
  return { region_slug: a.regionSlug, city_slug: a.citySlug, neighborhood_slug: a.neighborhoodSlug };
}

async function backfillTable(table: "listings" | "venues") {
  const { data, error } = await c
    .from(table)
    .select("id, neighborhood, region_slug, city_slug, neighborhood_slug");
  if (error) throw new Error(`${table} lookup failed: ${error.message}`);

  let updated = 0;
  let unresolved = 0;
  const unresolvedLabels = new Set<string>();

  for (const row of data ?? []) {
    const next = resolveRow(row.neighborhood as string | null);
    if (!next.region_slug && row.neighborhood) {
      unresolved++;
      unresolvedLabels.add(row.neighborhood as string);
    }
    const changed =
      next.region_slug !== row.region_slug ||
      next.city_slug !== row.city_slug ||
      next.neighborhood_slug !== row.neighborhood_slug;
    if (!changed) continue;

    if (APPLY) {
      const { error: upErr } = await c.from(table).update(next).eq("id", row.id as string);
      if (upErr) {
        console.error(`  ${table} update failed for ${row.id}: ${upErr.message}`);
        continue;
      }
    }
    updated++;
  }

  console.log(
    `[${table}] ${APPLY ? "updated" : "would update"} ${updated} rows; ${unresolved} unresolved`,
  );
  if (unresolvedLabels.size > 0) {
    console.log(`  unresolved labels: ${[...unresolvedLabels].sort().join(", ")}`);
  }
}

async function backfillProfiles() {
  const { data, error } = await c
    .from("profiles")
    .select("user_id, neighborhoods, location_slugs");
  if (error) throw new Error(`profiles lookup failed: ${error.message}`);

  let updated = 0;
  for (const row of data ?? []) {
    const labels = (row.neighborhoods as string[] | null) ?? [];
    const slugs = labels
      .map((l) => resolveLocationLabel(l)?.slug)
      .filter((s): s is string => Boolean(s));
    const next = [...new Set(slugs)].sort();
    const current = [...((row.location_slugs as string[] | null) ?? [])].sort();
    if (JSON.stringify(next) === JSON.stringify(current)) continue;

    if (APPLY) {
      const { error: upErr } = await c
        .from("profiles")
        .update({ location_slugs: next })
        .eq("user_id", row.user_id as string);
      if (upErr) {
        console.error(`  profiles update failed for ${row.user_id}: ${upErr.message}`);
        continue;
      }
    }
    updated++;
  }
  console.log(`[profiles] ${APPLY ? "updated" : "would update"} ${updated} rows`);
}

console.log(APPLY ? "Applying location backfill…" : "Dry run (pass --apply to write)…");
await backfillTable("venues");
await backfillTable("listings");
await backfillProfiles();
console.log("Done.");
