import { createClient } from "@supabase/supabase-js";

const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const { data } = await c.from("listings").select("title, date_start, published_at").not("published_at", "is", null);
const now = Date.now();
let future = 0, past = 0, none = 0;
for (const r of data ?? []) {
  if (!r.date_start) { none++; continue; }
  const t = new Date(r.date_start as string).getTime();
  if (t >= now) future++; else past++;
}
console.log(`total: ${data?.length}, future: ${future}, past: ${past}, no-date: ${none}`);
console.log("\npast events sample:");
for (const r of (data ?? []).slice(0, 5)) {
  console.log(`  ${(r.date_start as string ?? '').slice(0,10)}  ${(r.title as string).slice(0,60)}`);
}
