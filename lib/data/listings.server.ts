import "server-only";

import type { Listing, ListingSource, ListingType, LifestyleTag, Venue } from "@/lib/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LISTINGS, getListingBySlug as getFixtureListingBySlug } from "./listings";
import { getVenueBySlug as getFixtureVenueBySlug } from "./venues";

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
  lat: number | null;
  lng: number | null;
}

interface DbVenueRow {
  id: string;
  slug: string;
  name: string;
}

// Map each category label to a fixture SVG with a matching emoji + gradient.
// Public/images/listings: 1=♫music 2=🍽food 3=🌿outdoor 4=⛰mountain 5=🍺drink
// 6=🎨arts 7=🥐brunch 8=😂comedy 9=🐕dog 10=🧘wellness 11=👶family 12=🎵music
const CATEGORY_TO_SVG: Record<string, number> = {
  Music: 1,
  "Food & Drink": 2,
  Outdoor: 4,
  "Arts & Culture": 6,
  Markets: 7,
  Sports: 4,
  Comedy: 8,
  Wellness: 10,
  Family: 11,
};
const FALLBACK_SVG = 12;

function placeholderForCategory(category: string | null, slug: string): string {
  // Prefer category-themed SVG. If category is unknown, hash slug to one of the
  // 12 fixture SVGs so a given listing always shows the same placeholder.
  if (category && CATEGORY_TO_SVG[category]) {
    return `/images/listings/${CATEGORY_TO_SVG[category]}.svg`;
  }
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  const n = (hash % 12) + 1;
  void FALLBACK_SVG;
  return `/images/listings/${n}.svg`;
}

function rowToListing(row: DbListingRow, venueBy: Map<string, DbVenueRow>): Listing {
  const venue = row.venue_id ? venueBy.get(row.venue_id) : undefined;
  // Scraped images are universally low quality — Instagram thumbnails get
  // downscaled, SerpAPI sometimes returns Google Maps screenshots instead of
  // event photos, and either way they clash with the design language. Always
  // use a category-themed SVG until we have a proper Supabase Storage upload
  // pipeline that gives us full-size images we control.
  const imageUrl = placeholderForCategory(row.category, row.slug);
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
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
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
        .select(
          "id, slug, type, title, description, venue_id, address, neighborhood, category, date_start, date_end, date_display, time_display, is_free, deal_value, image_url, source, source_url, tags, lat, lng",
        )
        .not("published_at", "is", null)
        .gte("date_start", cutoff)
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
        .select(
          "id, slug, type, title, description, venue_id, address, neighborhood, category, date_start, date_end, date_display, time_display, is_free, deal_value, image_url, source, source_url, tags, lat, lng",
        )
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
  if (fixture) return fixture;
  try {
    const client = await getSupabaseServerClient();
    const { data } = await client
      .from("venues")
      .select("id, slug, name, description, address, neighborhood, image_url, lat, lng")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return undefined;
    const r = data as {
      id: string; slug: string; name: string; description: string; address: string;
      neighborhood: string; image_url: string | null; lat: number | null; lng: number | null;
    };
    return {
      id: r.slug,
      slug: r.slug,
      name: r.name,
      description: r.description,
      address: r.address,
      neighborhood: r.neighborhood,
      imageUrl: r.image_url ?? undefined,
      lat: r.lat ?? 0,
      lng: r.lng ?? 0,
    };
  } catch (err) {
    console.error("[listings] getVenueBySlugAsync failed", err);
    return undefined;
  }
}

export async function getListingsByVenueSlugAsync(venueSlug: string): Promise<Listing[]> {
  // Pull from merged set so fixture + scraped events at the same venue both surface.
  const all = await getMergedListings();
  return all.filter((l) => l.venueId === venueSlug);
}

