/**
 * Derive venues.categories from each venue's listings + its name.
 *
 * Vocabulary (matches lib/data/categories.ts VENUE_CATEGORIES):
 *   food-drink, music, entertainment, family-friendly, sports, arts-culture,
 *   outdoors, brewery-distillery, comedy, nightlife
 *
 * Signals:
 *   - listing category (mapped to richer venue categories)
 *   - family lifestyle tag → family-friendly
 *   - venue name keywords (brewing/distillery, bar/lounge, theatre/hall,
 *     park/garden, restaurant/cafe, museum/gallery, comedy)
 *
 * Usage: tsx scripts/backfill-venue-categories.mts [--apply]
 */
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// Canonical order (mirrors VENUE_CATEGORIES) so stored arrays render in order.
const ORDER = [
  "food-drink", "music", "entertainment", "family-friendly", "sports",
  "arts-culture", "outdoors", "brewery-distillery", "comedy", "nightlife",
];
const orderOf = (s: string) => {
  const i = ORDER.indexOf(s);
  return i === -1 ? 999 : i;
};

// Listing category label → its slug (mirrors CATEGORIES).
const LISTING_LABEL_TO_SLUG = new Map<string, string>([
  ["music", "music"], ["food & drink", "food-drink"], ["outdoor", "outdoor"],
  ["arts & culture", "arts-culture"], ["markets", "markets"], ["sports", "sports"],
  ["comedy", "comedy"], ["wellness", "wellness"],
]);

// Listing category slug → venue category slugs.
const LISTING_TO_VENUE: Record<string, string[]> = {
  music: ["music", "entertainment"],
  "food-drink": ["food-drink"],
  outdoor: ["outdoors"],
  "arts-culture": ["arts-culture", "entertainment"],
  markets: ["food-drink", "family-friendly"],
  sports: ["sports"],
  comedy: ["comedy", "entertainment"],
  // wellness → no venue category
};

function nameSignals(name: string): string[] {
  const n = name.toLowerCase();
  const out: string[] = [];
  if (/brew|distill|taproom|cidery|meadery/.test(n)) out.push("brewery-distillery", "food-drink");
  if (/\b(bar|lounge|club|nightclub|speakeasy|saloon|cocktail|pub)\b/.test(n)) out.push("nightlife");
  if (/theat|cinema|film|playhouse|opera|ballroom|amphitheat|\bhall\b|arena|stadium/.test(n)) out.push("entertainment");
  if (/park|garden|trail|mountain|\blake\b|open space|botanic|\bfield\b/.test(n)) out.push("outdoors");
  if (/restaurant|kitchen|eatery|cafe|coffee|grill|diner|bistro|taqueria|pizz|tavern|brunch|bakery|creamery|ice cream/.test(n)) out.push("food-drink");
  if (/museum|gallery/.test(n)) out.push("arts-culture");
  if (/comedy/.test(n)) out.push("comedy", "entertainment");
  return out;
}

// Aggregate listing signals per venue.
const listingCats = new Map<string, Set<string>>(); // venue_id → listing category slugs
const familyVenues = new Set<string>();

let from = 0;
const PAGE = 1000;
for (;;) {
  const { data, error } = await c
    .from("listings")
    .select("venue_id, category, tags")
    .not("venue_id", "is", null)
    .range(from, from + PAGE - 1);
  if (error) throw new Error(`listings page failed: ${error.message}`);
  const rows = data ?? [];
  for (const l of rows) {
    const vid = l.venue_id as string | null;
    if (!vid) continue;
    const set = listingCats.get(vid) ?? new Set<string>();
    const slug = l.category ? LISTING_LABEL_TO_SLUG.get((l.category as string).toLowerCase()) : undefined;
    if (slug) set.add(slug);
    listingCats.set(vid, set);
    const tags = (l.tags as string[] | null) ?? [];
    if (tags.includes("family")) familyVenues.add(vid);
  }
  if (rows.length < PAGE) break;
  from += PAGE;
}

const { data: venues, error: vErr } = await c.from("venues").select("id, name, categories");
if (vErr) throw new Error(`venues lookup failed: ${vErr.message}`);

let updated = 0;
for (const v of venues ?? []) {
  const id = v.id as string;
  const out = new Set<string>();
  for (const lslug of listingCats.get(id) ?? []) {
    for (const vc of LISTING_TO_VENUE[lslug] ?? []) out.add(vc);
  }
  if (familyVenues.has(id)) out.add("family-friendly");
  for (const vc of nameSignals((v.name as string) ?? "")) out.add(vc);

  const next = [...out].sort((a, b) => orderOf(a) - orderOf(b));
  const current = [...(((v.categories as string[] | null) ?? []))];
  if (JSON.stringify(next) === JSON.stringify(current)) continue;
  if (APPLY) {
    const { error } = await c.from("venues").update({ categories: next }).eq("id", id);
    if (error) {
      console.error(`  update failed for ${id}: ${error.message}`);
      continue;
    }
  }
  updated++;
}

console.log(`${APPLY ? "updated" : "would update"} ${updated} venues`);
