import { createClient } from "@supabase/supabase-js";

const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const { data: venues } = await c.from("venues").select("id, neighborhood");
const venueMap = new Map<string, string>();
for (const v of venues ?? []) venueMap.set(v.id as string, v.neighborhood as string);

const { data: listings } = await c
  .from("listings")
  .select("id, venue_id, neighborhood")
  .not("venue_id", "is", null);

let fixed = 0;
for (const l of listings ?? []) {
  const venueHood = venueMap.get(l.venue_id as string);
  if (venueHood && venueHood !== l.neighborhood) {
    const { error } = await c
      .from("listings")
      .update({ neighborhood: venueHood })
      .eq("id", l.id as string);
    if (!error) fixed++;
  }
}
console.log(`fixed ${fixed} rows`);
