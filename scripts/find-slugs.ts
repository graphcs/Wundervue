import { createClient } from "@supabase/supabase-js";

async function main() {
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const titles = process.argv.slice(2);
  if (titles.length === 0) {
    console.error("usage: find-slugs.ts <title fragment> [<title fragment>...]");
    process.exit(1);
  }

  const ors = titles.map((t) => `title.ilike.%${t}%`).join(",");
  const { data, error } = await c
    .from("listings")
    .select("slug, title, image_url")
    .or(ors)
    .not("published_at", "is", null);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  for (const r of data ?? []) {
    console.log(`${r.slug}  |  ${r.title}  |  ${(r.image_url ?? "").slice(0, 100)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
