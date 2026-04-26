import { createClient } from "@supabase/supabase-js";
async function main() {
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const todayStart = new Date(); todayStart.setUTCHours(0,0,0,0);
const { data: pub } = await c.from("listings").select("id").not("published_at","is",null).gte("date_start", todayStart.toISOString());
const { data: dup } = await c.from("listings").select("id").is("published_at",null).not("dedup_of","is",null);
console.log(`published & upcoming: ${pub?.length}`);
console.log(`hidden as duplicates: ${dup?.length}`);
}
main();
