import { createClient } from "@supabase/supabase-js";
import { clusterCandidates } from "@/lib/ingest/dedupCluster";

interface Row {
  id: string;
  title: string;
  description: string;
  source: string;
  venue_id: string | null;
  address: string | null;
  date_start: string | null;
  event_key: string;
  created_at: string;
}

async function main() {
const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// 1. Find all calendar days with ≥2 published events.
const { data: all } = await c
  .from("listings")
  .select("date_start")
  .not("published_at", "is", null)
  .not("date_start", "is", null);

const counts = new Map<string, number>();
for (const r of (all ?? []) as Array<{ date_start: string }>) {
  const day = r.date_start.slice(0, 10);
  counts.set(day, (counts.get(day) ?? 0) + 1);
}
const candidateDays = [...counts.entries()].filter(([, n]) => n >= 2).map(([d]) => d);
console.log(`days to check: ${candidateDays.length}`);

let totalCompared = 0;
let totalMarked = 0;

for (const day of candidateDays) {
  const dayStart = `${day}T00:00:00Z`;
  const dayEnd = `${day}T23:59:59Z`;
  const { data: rows } = await c
    .from("listings")
    .select("id, title, description, source, venue_id, address, date_start, event_key, created_at")
    .gte("date_start", dayStart)
    .lte("date_start", dayEnd)
    .not("published_at", "is", null)
    .order("created_at", { ascending: true })
    .limit(40);
  const candidates = (rows ?? []) as Row[];
  if (candidates.length < 2) continue;
  const distinctKeys = new Set(candidates.map((r) => r.event_key));
  if (distinctKeys.size < 2) continue;

  const result = await clusterCandidates(candidates);
  totalCompared++;

  let markedThisDay = 0;
  for (const group of result.groups) {
    if (group.length < 2) continue;
    const groupRows = group.map((i) => candidates[i]).filter(Boolean) as Row[];
    if (groupRows.length < 2) continue;
    groupRows.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const canonical = groupRows[0];
    const dupIds = groupRows.slice(1).map((r) => r.id);
    const { error } = await c
      .from("listings")
      .update({ published_at: null, dedup_of: canonical.id })
      .in("id", dupIds);
    if (error) {
      console.error(`update failed for day ${day}:`, error.message);
      continue;
    }
    markedThisDay += dupIds.length;
    console.log(
      `  ${day}: kept "${canonical.title}" (${canonical.source}); hid ${dupIds.length}: ${groupRows.slice(1).map((r) => `"${r.title}"`).join(", ")}`,
    );
  }
  totalMarked += markedThisDay;
}

console.log(`\ntotal: compared ${totalCompared} day-groups, marked ${totalMarked} duplicates`);
}

main().catch((err) => { console.error(err); process.exit(1); });
