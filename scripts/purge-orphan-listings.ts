#!/usr/bin/env tsx
/**
 * Purge listings whose source is no longer in the curated config (lib/ingest/sources.ts).
 *
 * Background: removing/renaming a source in sources.ts does NOT delete the rows
 * it already wrote, and `listings` has no column recording which config source
 * produced a row — only `source` (the label) and `source_id` (the connector's
 * per-item key). Web/calendar connectors key `source_id` as "<configId>:<url>"
 * or "<configId>-<slug>", so those rows ARE attributable to a config id by
 * prefix. Instagram keys it as the bare post shortcode and other connectors use
 * hashes/UUIDs/numeric ids — those are NOT attributable, so we never delete them.
 *
 * This script deletes ONLY the attributable orphans: rows whose lowercase,
 * hyphenated source-id prefix is not a current SOURCES id (and is not a UUID).
 *
 * Usage:
 *   tsx --env-file=.env scripts/purge-orphan-listings.ts          # dry-run (default)
 *   tsx --env-file=.env scripts/purge-orphan-listings.ts --apply  # actually delete
 */
import { createClient } from "@supabase/supabase-js";
import { SOURCES } from "@/lib/ingest/sources";

const APPLY = process.argv.includes("--apply");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONFIG_STYLE = /^[a-z0-9]+(?:-[a-z0-9]+)+$/; // lowercase, hyphenated, e.g. "visit-denver-web"

function prefixOf(sourceId: string): string {
  return (sourceId || "").split(":")[0];
}

/** Attributable to a (removed) config source iff the prefix looks like a config
 *  id (lowercase-hyphenated, not a UUID) and is not a current source id. */
function isAttributableOrphan(sourceId: string, live: Set<string>): boolean {
  const p = prefixOf(sourceId);
  if (!p || live.has(p)) return false;
  if (UUID.test(p)) return false;
  return CONFIG_STYLE.test(p);
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const live = new Set(SOURCES.map((s) => s.id));

  // Page through every listing.
  let from = 0;
  const all: { id: string; source: string; source_id: string; title: string; date_start: string | null }[] = [];
  for (;;) {
    const { data, error } = await sb
      .from("listings")
      .select("id, source, source_id, title, date_start")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  const doomed = all.filter((l) => isAttributableOrphan(l.source_id, live));
  const byPrefix = new Map<string, typeof doomed>();
  for (const l of doomed) {
    const p = prefixOf(l.source_id);
    (byPrefix.get(p) ?? byPrefix.set(p, []).get(p)!).push(l);
  }

  console.log(`total listings: ${all.length}`);
  console.log(`attributable orphans to delete: ${doomed.length}\n`);
  for (const [p, rows] of [...byPrefix.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const liveVenue = live.has(p.replace(/-events$/, "-web")) ? " (stale rename of an active source)" : "";
    console.log(`  ${rows.length.toString().padStart(3)}  ${p}${liveVenue}`);
    for (const r of rows.slice(0, 2)) console.log(`         e.g. "${r.title}" (start=${r.date_start ?? "?"})`);
  }

  // Report what is intentionally LEFT (unattributable).
  const kept = all.filter((l) => !isAttributableOrphan(l.source_id, live) && !live.has(prefixOf(l.source_id)));
  const ig = kept.filter((l) => l.source === "Instagram").length;
  console.log(`\nleft untouched (unattributable): ${kept.length} — Instagram=${ig}, hash/uuid/numeric=${kept.length - ig}`);

  if (!APPLY) {
    console.log("\nDRY-RUN — no rows deleted. Re-run with --apply to delete the listed orphans.");
    return;
  }

  // Delete in batches of 100 ids.
  const ids = doomed.map((l) => l.id);
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { error } = await sb.from("listings").delete().in("id", batch);
    if (error) throw new Error(error.message);
    deleted += batch.length;
  }
  console.log(`\nDELETED ${deleted} orphan listings.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
