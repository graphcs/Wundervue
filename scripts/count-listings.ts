import { createClient } from "@supabase/supabase-js";

async function main() {
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { count: total } = await c
    .from("listings")
    .select("*", { count: "exact", head: true });

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Only listings the explore feed actually shows: published, not deduped,
  // and starting today or later.
  const { count: visible } = await c
    .from("listings")
    .select("*", { count: "exact", head: true })
    .not("published_at", "is", null)
    .is("dedup_of", null)
    .gte("date_start", todayStart.toISOString());

  // Aggregate by the source_id prefix only when it has the "<sourceId>:..."
  // shape (cheerioWeb, jsonLdEvents, serpEvents). Instagram IDs are bare
  // shortcodes with no prefix; we identify those rows by source='Instagram'
  // and bucket them together.
  const { data: bySource } = await c
    .from("listings")
    .select("source_id, source")
    .not("published_at", "is", null)
    .is("dedup_of", null)
    .gte("date_start", todayStart.toISOString());

  const counts = new Map<string, number>();
  for (const r of bySource ?? []) {
    const id = r.source_id as string;
    const colon = id.indexOf(":");
    const key =
      colon > 0
        ? id.slice(0, colon)
        : r.source === "Instagram"
          ? "instagram (legacy)"
          : "other";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  console.log("Total rows in listings table:", total);
  console.log("Visible on site (published, not deduped, upcoming):", visible);
  console.log("\nBy source-id prefix (visible only):");
  for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(35)} ${v}`);
  }
}

void main();
