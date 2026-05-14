// Audit of all enabled ingest sources: latest run status, recent
// throughput, and a fuzzy-duplicate sweep on what's currently visible on
// /explore. Surfaces sources that are silently dark and event clusters
// the dedup system missed.

import { createClient } from "@supabase/supabase-js";
import { SOURCES } from "../lib/ingest/sources";

async function main() {
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Per-source latest run.
  console.log("=== Source health (latest run) ===");
  for (const s of SOURCES) {
    if (!s.enabled) continue;
    const { data } = await c
      .from("source_runs")
      .select("status, started_at, items_seen, items_inserted, error")
      .eq("source_id", s.id)
      .order("started_at", { ascending: false })
      .limit(1);
    const r = data?.[0];
    const tag = !r
      ? "NEVER"
      : r.status === "ok"
        ? "OK"
        : r.status === "failed"
          ? "FAIL"
          : r.status.toUpperCase();
    const ageDays = r?.started_at
      ? Math.round((Date.now() - new Date(r.started_at).getTime()) / 86400000)
      : null;
    const age = ageDays === null ? "—" : `${ageDays}d ago`;
    const stats = r ? `seen=${r.items_seen} ins=${r.items_inserted}` : "";
    const err = (r?.error ?? "").slice(0, 50);
    console.log(
      " ",
      tag.padEnd(6),
      s.id.padEnd(28),
      s.connector.padEnd(13),
      age.padEnd(10),
      stats.padEnd(20),
      err,
    );
  }

  // Visible-on-/explore listings, fuzzy-dupe scan: same first-4-words
  // of title + same date_start day. The system's hash-based dedup
  // catches exact matches; this surfaces near-matches that slipped
  // through.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const { data: rows } = await c
    .from("listings")
    .select("id, title, date_start, source, source_id, dedup_of")
    .not("published_at", "is", null)
    .is("dedup_of", null)
    .gte("date_start", today.toISOString())
    .order("date_start", { ascending: true });

  const visible = rows ?? [];
  const byKey = new Map<string, typeof visible>();
  for (const r of visible) {
    const t = (r.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .join(" ");
    const d = (r.date_start || "").slice(0, 10);
    const key = `${t}|${d}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(r);
  }
  const dupClusters = [...byKey.entries()].filter(([, v]) => v.length > 1);

  console.log(`\n=== Visibility totals ===`);
  console.log(`  Visible on /explore: ${visible.length}`);

  console.log(`\n=== Fuzzy-duplicate clusters (>1 visible row, same 4-word title + date) ===`);
  if (dupClusters.length === 0) {
    console.log("  none — clean");
  } else {
    for (const [, group] of dupClusters) {
      console.log(`\n  ${group.length}x on ${group[0].date_start?.slice(0, 10)}`);
      for (const r of group) {
        console.log(`    [${r.source}] ${r.title.slice(0, 75)}`);
      }
    }
  }

  // Source mix across /explore so we can confirm both website and
  // instagram are actively contributing.
  console.log(`\n=== Visible /explore by source label ===`);
  const bySource = new Map<string, number>();
  for (const r of visible) bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
  for (const [k, v] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(15)} ${v}`);
  }
}

void main();
