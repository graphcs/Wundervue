import { createClient } from "@supabase/supabase-js";
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const todayStart = new Date(); todayStart.setUTCHours(0,0,0,0);
const { data } = await c.from("listings").select("category, source").not("published_at","is",null).gte("date_start", todayStart.toISOString());
const byCat = new Map<string, number>();
const bySrc = new Map<string, number>();
for (const r of data ?? []) {
  byCat.set(r.category as string, (byCat.get(r.category as string) ?? 0) + 1);
  bySrc.set(r.source as string, (bySrc.get(r.source as string) ?? 0) + 1);
}
console.log("by category:");
for (const [k,v] of [...byCat.entries()].sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(18)} ${v}`);
console.log("\nby source:");
for (const [k,v] of [...bySrc.entries()].sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(12)} ${v}`);
