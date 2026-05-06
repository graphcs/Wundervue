#!/usr/bin/env tsx
/**
 * One-shot script: scrape each venue's Instagram and store the latest post
 * image as its `venues.image_url` in Supabase. Run after seeding venues to
 * populate the venues directory page with real photos.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-venue-images.ts
 *   npx tsx --env-file=.env scripts/backfill-venue-images.ts mission-ballroom snooze-eatery
 *
 * Without args, runs every entry in VENUE_HANDLES below.
 *
 * Cost: 1 Apify Instagram scrape per venue (~$0.01 each). No OpenRouter
 * quota used — we don't normalize, just grab the post image URL.
 */
import { ApifyClient } from "apify-client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STORAGE_BUCKET = "listings-images";

// Best-guess Instagram handles per venue slug. Some may 404 — failures are
// logged but don't block the rest. Edit this map if you have better handles.
const VENUE_HANDLES: Record<string, string> = {
  "mission-ballroom": "missionballroom",
  "lola-coastal-mexican": "lolacoastalmexican",
  "highlands-farmers-market": "highlandsfarmersmarket",
  "great-divide-brewing": "greatdividebrewco",
  "civic-center-park": "civiccentereats",
  "wash-park-brewing": "washparkbrewing",
  "snooze-eatery": "snoozeeatery",
  "rino-art-district": "rinoartdistrict",
  "santa-fe-art-district": "santafeartsdistrict",
  "little-man-ice-cream": "littlemanicecream",
  "the-squire-lounge": "squirelounge",
  // north-table-mountain has no obvious IG presence; left out
};

const ACTOR_ID = "apify/instagram-scraper";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

// Downloads the IG CDN image server-side (avoids the cross-origin/referrer
// block browsers hit) and uploads to our Storage bucket. Returns the public
// URL we control. Re-runs overwrite the same path via upsert.
async function rehostImage(
  supabase: SupabaseClient,
  slug: string,
  imageUrl: string,
): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`fetch ${imageUrl} → ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const path = `venues/${slug}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, {
      contentType,
      upsert: true,
      cacheControl: "31536000",
    });
  if (error) throw new Error(`storage upload: ${error.message}`);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function fetchFirstPostImage(
  apify: ApifyClient,
  handle: string,
): Promise<string | null> {
  const run = await apify.actor(ACTOR_ID).call(
    {
      directUrls: [`https://www.instagram.com/${handle}/`],
      resultsType: "posts",
      resultsLimit: 5,
      addParentData: false,
    },
    { timeout: 180 },
  );
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  const posts = items as Array<{ displayUrl?: string; caption?: string }>;
  // Prefer a post whose caption is non-empty (suggests a real branded post)
  // over the very first hit which can sometimes be a tagged photo.
  const withCaption = posts.find((p) => p.displayUrl && p.caption && p.caption.length > 20);
  return withCaption?.displayUrl ?? posts.find((p) => p.displayUrl)?.displayUrl ?? null;
}

async function main() {
  const apify = new ApifyClient({ token: required("APIFY_TOKEN") });
  const supabase = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const slugs = process.argv.slice(2).length
    ? process.argv.slice(2)
    : Object.keys(VENUE_HANDLES);

  let ok = 0;
  let failed = 0;
  for (const slug of slugs) {
    const handle = VENUE_HANDLES[slug];
    if (!handle) {
      console.warn(`[venue-images] ${slug}: no instagram handle configured, skipping`);
      continue;
    }
    console.log(`[venue-images] ${slug} ← @${handle}`);
    try {
      const sourceUrl = await fetchFirstPostImage(apify, handle);
      if (!sourceUrl) {
        console.warn(`[venue-images] ${slug}: scrape returned no image`);
        failed++;
        continue;
      }
      const hostedUrl = await rehostImage(supabase, slug, sourceUrl);
      const { error } = await supabase
        .from("venues")
        .update({ image_url: hostedUrl })
        .eq("slug", slug);
      if (error) {
        console.error(`[venue-images] ${slug} update failed: ${error.message}`);
        failed++;
      } else {
        console.log(`[venue-images] ${slug} ✓`);
        ok++;
      }
    } catch (err) {
      console.error(
        `[venue-images] ${slug} failed:`,
        err instanceof Error ? err.message : err,
      );
      failed++;
    }
  }

  console.log(`\n[venue-images] done — ${ok} updated, ${failed} failed`);
  process.exit(failed > 0 && ok === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
