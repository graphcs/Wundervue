#!/usr/bin/env tsx
/**
 * One-off: purge stale Gothic Theatre rows left behind by the connector
 * migration from apifyWeb → aegEvents (commit on branch fix/ingest-apify-external).
 *
 * The two connectors key source_id differently:
 *   - aegEvents (new): "gothic-theatre-web:<numericEventId>"   e.g. gothic-theatre-web:1383426
 *   - apifyWeb  (old): "gothic-theatre-web:<url>#<contenthash>" (NOT all-digits after the colon)
 *
 * Because the id scheme changed, the old rows were never overwritten — they
 * linger as duplicates (with dates off by a day, the old scrape's parse bug) or
 * as already-past shows that rolled off the venue's upcoming feed. We delete
 * exactly the rows whose source_id has the gothic-theatre-web: prefix but whose
 * tail is NOT the new all-numeric eventId, leaving every fresh aegEvents row.
 *
 * Usage:
 *   tsx --env-file=.env.local --env-file=.env scripts/purge-stale-gothic-rows.ts          # dry-run
 *   tsx --env-file=.env.local --env-file=.env scripts/purge-stale-gothic-rows.ts --apply  # delete
 */
import { getServiceClient } from "@/lib/ingest/persist";

const APPLY = process.argv.includes("--apply");
const PREFIX = "gothic-theatre-web:";
const FRESH = /^gothic-theatre-web:\d+$/; // new aegEvents key — keep these

async function main() {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("listings")
    .select("id, title, date_start, source_id")
    .like("source_id", `${PREFIX}%`);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const fresh = rows.filter((r) => FRESH.test(r.source_id));
  const stale = rows.filter((r) => !FRESH.test(r.source_id));

  console.log(`gothic-theatre-web rows: ${rows.length}`);
  console.log(`  keep  (aegEvents :<eventId>): ${fresh.length}`);
  console.log(`  purge (old apifyWeb format):  ${stale.length}\n`);
  for (const r of stale.sort((a, b) => (a.date_start ?? "").localeCompare(b.date_start ?? ""))) {
    console.log(`  ${r.date_start?.slice(0, 10) ?? "????-??-??"}  ${r.title}`);
  }

  if (!APPLY) {
    console.log("\nDRY-RUN — no rows deleted. Re-run with --apply to delete the listed rows.");
    return;
  }

  // Defensive: never delete a fresh aegEvents row.
  if (stale.some((r) => FRESH.test(r.source_id))) throw new Error("refusing: a fresh row slipped into the delete set");

  const ids = stale.map((r) => r.id);
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { error: delErr } = await sb.from("listings").delete().in("id", batch);
    if (delErr) throw new Error(`deleted ${deleted} before failure: ${delErr.message}`);
    deleted += batch.length;
  }
  console.log(`\nDELETED ${deleted} stale Gothic rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
