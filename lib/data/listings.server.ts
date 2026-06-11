import "server-only";

import type { Listing, ListingSource, ListingType, LifestyleTag, Venue } from "@/lib/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LISTINGS, getListingBySlug as getFixtureListingBySlug } from "./listings";
import { getVenueBySlug as getFixtureVenueBySlug } from "./venues";

// Single source for the listing column list — shared by the feed + detail reads.
const LISTING_COLUMNS =
  "id, slug, type, title, description, venue_id, address, neighborhood, category, date_start, date_end, date_display, time_display, is_free, deal_value, image_url, source, source_url, tags, save_count, lat, lng";

interface DbListingRow {
  id: string;
  slug: string;
  type: string;
  title: string;
  description: string;
  venue_id: string | null;
  address: string | null;
  neighborhood: string | null;
  category: string | null;
  date_start: string | null;
  date_end: string | null;
  date_display: string | null;
  time_display: string | null;
  is_free: boolean;
  deal_value: string | null;
  image_url: string | null;
  source: string;
  source_url: string | null;
  tags: string[];
  save_count: number | null;
  lat: number | null;
  lng: number | null;
}

interface DbVenueRow {
  id: string;
  slug: string;
  name: string;
}

function rowToListing(row: DbListingRow, venueBy: Map<string, DbVenueRow>): Listing {
  const venue = row.venue_id ? venueBy.get(row.venue_id) : undefined;
  // Ingest pipeline (lib/ingest/imagePipeline.ts) writes a Supabase Storage URL
  // here for every published row — either the scraped photo (when it passed
  // the size/ratio probe) or a Flux 2 Pro generation. Empty string is a
  // transition-only fallback for legacy rows that haven't been backfilled yet.
  const imageUrl = row.image_url ?? "";
  return {
    id: row.id,
    slug: row.slug,
    type: row.type as ListingType,
    title: row.title,
    description: row.description,
    venueId: venue?.slug ?? row.venue_id ?? "",
    venueName: venue?.name ?? "",
    address: row.address ?? "",
    neighborhood: row.neighborhood ?? "",
    category: row.category ?? "",
    startAt: row.date_start ?? "",
    endAt: row.date_end,
    dateDisplay: row.date_display ?? "",
    timeDisplay: row.time_display ?? "",
    isFree: row.is_free,
    dealValue: row.deal_value ?? undefined,
    imageUrl,
    source: row.source as ListingSource,
    sourceUrl: row.source_url ?? undefined,
    tags: (row.tags ?? []) as LifestyleTag[],
    saveCount: row.save_count ?? 0,
    lat: row.lat,
    lng: row.lng,
  };
}

export async function getPublishedListings(): Promise<Listing[]> {
  try {
    const client = await getSupabaseServerClient();
    // Today's start in UTC — keeps events that start later today visible even
    // after their evening kick-off, since users browsing in the morning are
    // looking for things to do tonight.
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const cutoff = todayStart.toISOString();

    const [{ data: rows }, { data: venues }] = await Promise.all([
      client
        .from("listings")
        .select(LISTING_COLUMNS)
        .not("published_at", "is", null)
        // Show anything not yet over: an event whose end is today-or-later (an
        // ongoing multi-week run that started earlier), or — when there's no
        // end — whose start is today-or-later. Mirrors expirePastEvents' cutoff
        // so the feed and the is_past sweep agree.
        .or(`date_end.gte.${cutoff},and(date_end.is.null,date_start.gte.${cutoff})`)
        .order("date_start", { ascending: true, nullsFirst: false }),
      client.from("venues").select("id, slug, name"),
    ]);
    const venueMap = new Map<string, DbVenueRow>();
    for (const v of (venues ?? []) as DbVenueRow[]) venueMap.set(v.id, v);
    return ((rows ?? []) as DbListingRow[]).map((r) => rowToListing(r, venueMap));
  } catch (err) {
    console.error("[listings] getPublishedListings failed", err);
    return [];
  }
}

// Returns an image URL for each venue, keyed by venue slug. Source of truth
// resolution order:
//   1. `venues.image_url` — populated by scripts/backfill-venue-images.ts
//      from each venue's Instagram. Curated, always venue-identity content.
//   2. The most recent listing's `image_url` at that venue — fallback when
//      we haven't backfilled the venue yet.
// Falls back to an empty map on DB error so the page still renders with
// gradient placeholders.
export async function getVenueImageMapBySlug(): Promise<Map<string, string>> {
  try {
    const client = await getSupabaseServerClient();
    const [venuesRes, listingsRes] = await Promise.all([
      client
        .from("venues")
        .select("slug, image_url")
        .not("image_url", "is", null),
      client
        .from("listings")
        .select("image_url, venues!inner(slug)")
        .not("image_url", "is", null)
        .not("published_at", "is", null)
        .order("created_at", { ascending: false }),
    ]);

    const map = new Map<string, string>();

    // Listings first (lower priority) — overwritten by venues.image_url below.
    for (const row of (listingsRes.data ?? []) as Array<{
      image_url: string | null;
      venues: { slug: string } | { slug: string }[] | null;
    }>) {
      if (!row.image_url || !row.venues) continue;
      const slug = Array.isArray(row.venues)
        ? row.venues[0]?.slug
        : row.venues.slug;
      if (!slug || map.has(slug)) continue;
      map.set(slug, row.image_url);
    }

    // Venue-curated images take priority.
    for (const row of (venuesRes.data ?? []) as Array<{
      slug: string;
      image_url: string | null;
    }>) {
      if (row.image_url) map.set(row.slug, row.image_url);
    }

    return map;
  } catch (err) {
    console.error("[listings] getVenueImageMapBySlug failed", err);
    return new Map();
  }
}

export async function getMergedListings(): Promise<Listing[]> {
  const fromDb = await getPublishedListings();
  // Dedupe by slug — fixtures and DB shouldn't collide, but if they do the
  // DB row wins (newer, real data).
  const bySlug = new Map<string, Listing>();
  for (const l of LISTINGS) bySlug.set(l.slug, l);
  for (const l of fromDb) bySlug.set(l.slug, l);
  return Array.from(bySlug.values());
}

export async function getListingBySlugAsync(slug: string): Promise<Listing | undefined> {
  // Fixtures are in-memory; check first to avoid a DB roundtrip for static pages.
  const fixture = getFixtureListingBySlug(slug);
  if (fixture) return fixture;
  try {
    const client = await getSupabaseServerClient();
    const [{ data: row }, { data: venues }] = await Promise.all([
      client
        .from("listings")
        .select(LISTING_COLUMNS)
        .eq("slug", slug)
        .not("published_at", "is", null)
        .maybeSingle(),
      client.from("venues").select("id, slug, name"),
    ]);
    if (!row) return undefined;
    const venueMap = new Map<string, DbVenueRow>();
    for (const v of (venues ?? []) as DbVenueRow[]) venueMap.set(v.id, v);
    return rowToListing(row as DbListingRow, venueMap);
  } catch (err) {
    console.error("[listings] getListingBySlugAsync failed", err);
    return undefined;
  }
}

export async function getVenueBySlugAsync(slug: string): Promise<Venue | undefined> {
  const fixture = getFixtureVenueBySlug(slug);
  // Even for a fixture venue, prefer DB categories (the fixture has none).
  try {
    const client = await getSupabaseServerClient();
    const { data } = await client
      .from("venues")
      .select("id, slug, name, description, address, neighborhood, image_url, lat, lng, categories")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return fixture;
    const r = data as {
      id: string; slug: string; name: string; description: string; address: string;
      neighborhood: string; image_url: string | null; lat: number | null; lng: number | null;
      categories: string[] | null;
    };
    return {
      id: r.slug,
      slug: r.slug,
      name: r.name,
      description: r.description,
      address: r.address,
      neighborhood: r.neighborhood,
      imageUrl: r.image_url ?? fixture?.imageUrl ?? undefined,
      lat: r.lat ?? 0,
      lng: r.lng ?? 0,
      categories: r.categories ?? [],
    };
  } catch (err) {
    console.error("[listings] getVenueBySlugAsync failed", err);
    return fixture;
  }
}

export async function getListingsByVenueSlugAsync(venueSlug: string): Promise<Listing[]> {
  // Pull from merged set so fixture + scraped events at the same venue both surface.
  const all = await getMergedListings();
  return all.filter((l) => l.venueId === venueSlug);
}

// All published listings at a venue, INCLUDING past ones (no date cutoff), so
// the venue page can show an archive tab. Falls back to the future-only merged
// set for fixture-only venues that have no DB row.
export async function getVenueListingsAllAsync(venueSlug: string): Promise<Listing[]> {
  try {
    const client = await getSupabaseServerClient();
    const { data: venueRow } = await client
      .from("venues")
      .select("id, slug, name")
      .eq("slug", venueSlug)
      .maybeSingle();
    if (!venueRow) return getListingsByVenueSlugAsync(venueSlug);

    const { data: rows } = await client
      .from("listings")
      .select(LISTING_COLUMNS)
      .eq("venue_id", (venueRow as { id: string }).id)
      .not("published_at", "is", null)
      .order("date_start", { ascending: true, nullsFirst: false });

    const venueMap = new Map<string, DbVenueRow>();
    venueMap.set((venueRow as DbVenueRow).id, venueRow as DbVenueRow);
    const fromDb = ((rows ?? []) as DbListingRow[]).map((r) => rowToListing(r, venueMap));
    if (fromDb.length > 0) return fromDb;
    // No DB listings (e.g. fixture-only venue) — fall back to fixtures.
    return getListingsByVenueSlugAsync(venueSlug);
  } catch (err) {
    console.error("[listings] getVenueListingsAllAsync failed", err);
    return getListingsByVenueSlugAsync(venueSlug);
  }
}

export interface BrowseVenue {
  slug: string;
  name: string;
  description: string;
  address: string;
  neighborhood: string;
  categories: string[];
  upcomingCount: number;
}

// Real venues (from ingestion) that have at least one upcoming listing, sorted
// by activity. Powers the /venues browse grid. Counts use the same "today UTC"
// cutoff as the explore feed so "upcoming" means the same thing everywhere.
export async function getBrowseVenues(): Promise<BrowseVenue[]> {
  try {
    const client = await getSupabaseServerClient();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const cutoff = todayStart.toISOString();

    const [venuesRes, listingsRes] = await Promise.all([
      client.from("venues").select("id, slug, name, description, address, neighborhood, categories"),
      client
        .from("listings")
        .select("venue_id")
        .not("published_at", "is", null)
        .not("venue_id", "is", null)
        // Match getPublishedListings exactly: an ongoing run (end today-or-later)
        // or a future single-date event. Keeps the venue count in step with the
        // explore feed so a mid-run event isn't shown but uncounted.
        .or(`date_end.gte.${cutoff},and(date_end.is.null,date_start.gte.${cutoff})`),
    ]);

    const counts = new Map<string, number>();
    for (const r of (listingsRes.data ?? []) as Array<{ venue_id: string | null }>) {
      if (!r.venue_id) continue;
      counts.set(r.venue_id, (counts.get(r.venue_id) ?? 0) + 1);
    }

    const out: BrowseVenue[] = [];
    for (const v of (venuesRes.data ?? []) as Array<{
      id: string; slug: string; name: string; description: string | null; address: string | null;
      neighborhood: string | null; categories: string[] | null;
    }>) {
      const upcomingCount = counts.get(v.id) ?? 0;
      if (upcomingCount === 0) continue;
      out.push({
        slug: v.slug,
        name: v.name,
        description: v.description ?? "",
        address: v.address ?? "",
        neighborhood: v.neighborhood ?? "",
        categories: v.categories ?? [],
        upcomingCount,
      });
    }
    out.sort((a, b) => b.upcomingCount - a.upcomingCount || a.name.localeCompare(b.name));
    return out;
  } catch (err) {
    console.error("[listings] getBrowseVenues failed", err);
    return [];
  }
}

// slug → category slugs, for chips/filtering on the venues browse page.
export async function getVenueCategoryMapBySlug(): Promise<Map<string, string[]>> {
  try {
    const client = await getSupabaseServerClient();
    const { data } = await client.from("venues").select("slug, categories");
    const map = new Map<string, string[]>();
    for (const row of (data ?? []) as Array<{ slug: string; categories: string[] | null }>) {
      if (row.categories && row.categories.length) map.set(row.slug, row.categories);
    }
    return map;
  } catch (err) {
    console.error("[listings] getVenueCategoryMapBySlug failed", err);
    return new Map();
  }
}

