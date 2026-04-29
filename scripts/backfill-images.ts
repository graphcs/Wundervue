import { createClient } from "@supabase/supabase-js";
import { resolveListingImage } from "@/lib/ingest/imagePipeline";

// Inlined to avoid an ESM dual-resolution issue tsx hits when the script
// imports `@/lib/ingest/uploadImage` while imagePipeline imports the same
// file via the relative `./uploadImage` path — Node treats them as separate
// module instances and the alias one trips on its own export check.
const STORAGE_BUCKET_URL_FRAGMENT = "/storage/v1/object/public/listings-images/";
function isStorageBucketUrl(url: string | null | undefined): boolean {
  return !!url && url.includes(STORAGE_BUCKET_URL_FRAGMENT);
}

// One-shot: walk every row in `listings` and ensure image_url points at our
// Supabase Storage bucket. For each row:
//   • already in our bucket → skip (idempotent re-runs).
//   • elsewhere or null → run the image pipeline (probe → AI → upload) and
//     write the resulting public URL back to the row.
//
// Run with: tsx scripts/backfill-images.mts
//   --limit=N        process at most N rows (useful for staged runs)
//   --dry            log decisions but don't update the DB
//   --slugs=a,b,c    only process rows with these exact slugs (force re-run
//                    even if they already point at our bucket — useful for
//                    fixing a specific bad card)

interface Row {
  id: string;
  slug: string;
  title: string;
  type: "event" | "deal" | "both";
  category: string | null;
  neighborhood: string | null;
  venue_id: string | null;
  image_url: string | null;
  source_url: string | null;
}

interface VenueRow {
  id: string;
  name: string;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dry = args.has("--dry");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
  const slugsArg = process.argv.find((a) => a.startsWith("--slugs="));
  const targetSlugs = slugsArg
    ? slugsArg.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  let q = c
    .from("listings")
    .select("id, slug, title, type, category, neighborhood, venue_id, image_url, source_url")
    .order("created_at", { ascending: false });
  if (targetSlugs) q = q.in("slug", targetSlugs);
  if (limit) q = q.limit(limit);

  const { data: listings, error: lErr } = await q;
  if (lErr) throw new Error(`listings query failed: ${lErr.message}`);
  const rows = (listings ?? []) as Row[];

  const { data: venues, error: vErr } = await c.from("venues").select("id, name");
  if (vErr) throw new Error(`venues query failed: ${vErr.message}`);
  const venueById = new Map<string, VenueRow>();
  for (const v of (venues ?? []) as VenueRow[]) venueById.set(v.id, v);

  console.log(`[backfill-images] rows=${rows.length} dry=${dry}`);

  let skipped = 0;
  let scraped = 0;
  let generated = 0;
  let failed = 0;

  for (const row of rows) {
    // --slugs= forces a re-process even if the row already points at our bucket
    // (you asked for this row by name, so respect that). Without --slugs we
    // skip rows that are already in our bucket so re-runs are cheap.
    if (!targetSlugs && isStorageBucketUrl(row.image_url)) {
      skipped++;
      continue;
    }
    const venueName = row.venue_id ? venueById.get(row.venue_id)?.name ?? null : null;
    try {
      const result = await resolveListingImage({
        slug: row.slug,
        sourceImageUrl: row.image_url,
        sourcePageUrl: row.source_url,
        meta: {
          title: row.title,
          category: row.category,
          neighborhood: row.neighborhood,
          venueName,
          type: row.type,
        },
      });
      if (result.source === "scraped") scraped++;
      else if (result.source === "generated") generated++;

      console.log(
        `  ${result.source.padEnd(9)} ${row.slug}  ${result.reason ? `(source ${result.reason})` : ""}`.trimEnd(),
      );

      if (!dry) {
        const { error: uErr } = await c
          .from("listings")
          .update({ image_url: result.url, image_source: result.source })
          .eq("id", row.id);
        if (uErr) throw new Error(`update failed: ${uErr.message}`);
      }
    } catch (err) {
      failed++;
      console.error(`  FAIL      ${row.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `[backfill-images] done — skipped=${skipped} scraped=${scraped} generated=${generated} failed=${failed}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
