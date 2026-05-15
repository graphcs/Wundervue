// One-shot recovery for IG sources locked out by the apify-client bundling
// bug (fixed in commit adding `serverExternalPackages: ["apify-client"]`).
// Each had 3+ consecutive `failed` runs starting 2026-05-11, which trips the
// orchestrator's recentFailureStreak guard and keeps the source skipped
// indefinitely (skipped runs aren't recorded, so the streak never decays).
//
// Deletes the offending failed rows for each affected source so the next
// cron tick re-enters the pipeline.
//
// Usage: tsx scripts/clear-ig-failure-streaks.ts

import { createClient } from "@supabase/supabase-js";

const SOURCES = [
  "mission-ballroom-ig",
  "denver-music-venues-ig",
  "denver-dogs-ig",
  "denver-family-ig",
  "denver-outdoor-ig",
  "denver-datenight-ig",
];

// Date of the apify-client breakage. Anything before this was working IG
// ingest — don't touch those rows.
const BREAKAGE_AT = "2026-05-10T00:00:00Z";

async function main() {
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  for (const id of SOURCES) {
    const { data: failed, error: lookupErr } = await c
      .from("source_runs")
      .select("id, started_at, error")
      .eq("source_id", id)
      .eq("status", "failed")
      .gte("started_at", BREAKAGE_AT);
    if (lookupErr) throw new Error(`lookup ${id}: ${lookupErr.message}`);

    if (!failed || failed.length === 0) {
      console.log(`✓ ${id}: nothing to clear`);
      continue;
    }

    const ids = failed.map((r) => r.id as string);
    const { error: delErr } = await c
      .from("source_runs")
      .delete()
      .in("id", ids);
    if (delErr) throw new Error(`delete ${id}: ${delErr.message}`);

    console.log(`✓ ${id}: deleted ${ids.length} failed row(s)`);
  }
}

void main();
