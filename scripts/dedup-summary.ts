import { createClient } from "@supabase/supabase-js";

async function main() {
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: pub, error: pubErr } = await c
    .from("listings")
    .select("id")
    .not("published_at", "is", null)
    .gte("date_start", todayStart.toISOString());
  if (pubErr) throw new Error(`published lookup failed: ${pubErr.message}`);

  const { data: dup, error: dupErr } = await c
    .from("listings")
    .select("id")
    .is("published_at", null)
    .not("dedup_of", "is", null);
  if (dupErr) throw new Error(`duplicate lookup failed: ${dupErr.message}`);

  console.log(`published & upcoming: ${pub?.length ?? 0}`);
  console.log(`hidden as duplicates: ${dup?.length ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
