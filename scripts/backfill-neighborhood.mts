import { createClient } from "@supabase/supabase-js";

const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const { data: venues, error: venuesErr } = await c
  .from("venues")
  .select("id, neighborhood");
if (venuesErr) throw new Error(`venues lookup failed: ${venuesErr.message}`);
const venueMap = new Map<string, string>();
for (const v of venues ?? []) venueMap.set(v.id as string, v.neighborhood as string);

const { data: listings, error: listingsErr } = await c
  .from("listings")
  .select("id, venue_id, neighborhood")
  .not("venue_id", "is", null);
if (listingsErr) throw new Error(`listings lookup failed: ${listingsErr.message}`);

let fixed = 0;
let failed = 0;
for (const l of listings ?? []) {
  const venueHood = venueMap.get(l.venue_id as string);
  if (venueHood && venueHood !== l.neighborhood) {
    const { error } = await c
      .from("listings")
      .update({ neighborhood: venueHood })
      .eq("id", l.id as string);
    if (error) {
      failed++;
      console.error(`update failed for listing ${l.id}: ${error.message}`);
    } else {
      fixed++;
    }
  }
}
console.log(`fixed ${fixed} rows, ${failed} failed`);
