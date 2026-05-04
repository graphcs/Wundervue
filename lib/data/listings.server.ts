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

