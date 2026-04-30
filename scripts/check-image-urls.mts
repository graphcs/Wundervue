import { createClient } from "@supabase/supabase-js";

const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const { data } = await c
  .from("listings")
  .select("title, image_url")
  .not("image_url", "is", null)
  .limit(5);

for (const row of data ?? []) {
  console.log(`${row.title.slice(0, 40).padEnd(42)} | ${(row.image_url as string).slice(0, 100)}`);
}
