import { createClient } from "@supabase/supabase-js";

const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const { data: listings } = await c
  .from("listings")
  .select(
    "title, type, category, neighborhood, date_display, time_display, is_free, source, published_at, dedup_of",
  )
  .order("created_at", { ascending: false })
  .limit(25);

console.log(`total recent: ${listings?.length}`);
for (const l of listings ?? []) {
  const flag = l.published_at ? "PUB" : "DUP";
  console.log(
    `[${flag}] ${l.type.padEnd(5)} ${(l.category ?? "").padEnd(15)} ${(l.neighborhood ?? "").padEnd(8)} ${(l.date_display ?? "").padEnd(15)} ${(l.time_display ?? "").padEnd(10)} ${l.is_free ? "FREE" : "    "} ${l.title.slice(0, 60)}`,
  );
}

const { data: runs } = await c
  .from("source_runs")
  .select(
    "source_id, status, items_seen, items_inserted, items_updated, items_duplicate, started_at",
  )
  .order("started_at", { ascending: false })
  .limit(5);

console.log("\nrecent runs:");
for (const r of runs ?? []) {
  console.log(
    `  ${r.source_id} status=${r.status} seen=${r.items_seen} ins=${r.items_inserted} upd=${r.items_updated} dup=${r.items_duplicate}`,
  );
}
