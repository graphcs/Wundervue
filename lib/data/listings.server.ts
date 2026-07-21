import "server-only";

import type { Listing, ListingSource, ListingType, LifestyleTag, Venue } from "@/lib/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LISTINGS, getListingBySlug as getFixtureListingBySlug } from "./listings";
import { getVenueBySlug as getFixtureVenueBySlug } from "./venues";
import { seriesFirstSeen, seriesBaseKey, isFresh } from "./freshness";
import { denverStartOfTodayISO } from "@/lib/dates";
import { isPastSpecificDateCard } from "@/lib/listings/isPast";

// Single source for the listing column list — shared by the feed + detail reads.
// created_at + source_id power the freshness signal (series-aware "first seen").
const LISTING_COLUMNS =
  "id, slug, type, title, description, venue_id, address, neighborhood, category, date_start, date_end, date_display, time_display, is_free, deal_value, image_url, source, source_url, ticket_url, tags, save_count, lat, lng, created_at, source_id";

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
  ticket_url: string | null;
  tags: string[];
  save_count: number | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  source_id: string;
}

interface DbVenueRow {
  id: string;
  slug: string;
  name: string;
}

function rowToListing(
  row: DbListingRow,
  venueBy: Map<string, DbVenueRow>,
  // The series' first-seen (min created_at across its occurrences). Defaults to
  // this row's own created_at when the caller has no series context (detail page).
  firstSeenAt: string = row.created_at,
): Listing {
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
    ticketUrl: row.ticket_url ?? undefined,
    tags: (row.tags ?? []) as LifestyleTag[],
    saveCount: row.save_count ?? 0,
    lat: row.lat,
    lng: row.lng,
    firstSeenAt,
    isNew: isFresh(firstSeenAt),
  };
}

export async function getPublishedListings(): Promise<Listing[]> {
  try {
    const client = await getSupabaseServerClient();
    // Start of today in DENVER (UTC instant) — keeps tonight's events visible to a
    // morning browser, but drops last night's evening events (which are already
    // "tomorrow" in UTC).
    const cutoff = denverStartOfTodayISO();
    const todayStart = new Date(cutoff);

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
    // Sort by EFFECTIVE date = max(date_start, today): a continuous run that
    // started weeks ago (date_start in the past, still ongoing) sorts as "today"
    // and interleaves with current events instead of camping at the top on its
    // stale start. Future events keep their real start; undated rows sort last.
    const cutoffMs = todayStart.getTime();
    const effective = (r: DbListingRow): number => {
      const ds = r.date_start ? Date.parse(r.date_start) : NaN;
      return Number.isNaN(ds) ? Infinity : Math.max(ds, cutoffMs);
    };
    const dbRows = (rows ?? []) as DbListingRow[];
    // Series-aware first-seen: a recurring series' future occurrences enter the
    // rolling window each week, so freshness must key on the series' EARLIEST
    // occurrence, not each row's own created_at.
    const firstSeen = seriesFirstSeen(dbRows);
    return dbRows
      .slice()
      .sort((a, b) => effective(a) - effective(b))
      .map((r) => rowToListing(r, venueMap, firstSeen.get(seriesBaseKey(r.source, r.source_id))))
      // Drop cards whose date_display is a specific PAST day: a recurring deal's
      // rolling date_end keeps it inside the query window, but a stale per-occurrence
      // date_start/date_display ("Thu, Jul 2") reads as a past event. Cadence cards
      // ("Every Thursday") are kept — isPastSpecificDateCard ignores them.
      .filter((l) => !isPastSpecificDateCard(l));
  } catch (err) {
    console.error("[listings] getPublishedListings failed", err);
    return [];
  }
}

// PostgREST caps a single SELECT at 1000 rows. Page through `buildPage` until a
// short page signals the end, returning every row. The query MUST apply a stable
// order (e.g. a unique `id`) so consecutive ranges don't overlap or skip rows.
// Throws on the first query error so callers' try/catch can fall back.
async function selectAllPaged<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildPage(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
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

    // Page the listings sweep (there are >1000 image-bearing listings, so a
    // single query would drop the older tail) concurrently with the curated
    // venue images — we only APPLY the latter after listings, to preserve its
    // priority. Listings ordered newest-first; the first image per venue wins.
    const [listingRows, venuesRes] = await Promise.all([
      selectAllPaged<{
        image_url: string | null;
        venues: { slug: string } | { slug: string }[] | null;
      }>((from, to) =>
        client
          .from("listings")
          .select("image_url, venues!inner(slug)")
          .not("image_url", "is", null)
          .not("published_at", "is", null)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      ),
      client.from("venues").select("slug, image_url").not("image_url", "is", null),
    ]);

    const map = new Map<string, string>();

    // Listings first (lower priority) — overwritten by venues.image_url below.
    for (const row of listingRows) {
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
      .select("id, slug, name, description, address, neighborhood, image_url, ticket_url, lat, lng, categories")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return fixture;
    const r = data as {
      id: string; slug: string; name: string; description: string; address: string;
      neighborhood: string; image_url: string | null; ticket_url: string | null;
      lat: number | null; lng: number | null; categories: string[] | null;
    };
    return {
      id: r.slug,
      slug: r.slug,
      name: r.name,
      description: r.description,
      address: r.address,
      neighborhood: r.neighborhood,
      imageUrl: r.image_url ?? fixture?.imageUrl ?? undefined,
      ticketUrl: r.ticket_url ?? undefined,
      lat: r.lat ?? 0,
      lng: r.lng ?? 0,
      categories: r.categories ?? [],
    };
  } catch (err) {
    console.error("[listings] getVenueBySlugAsync failed", err);
    return fixture;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The venue-default "Buy Tickets" link for a detail view. The listing's own
// ticketUrl always wins (resolved in the view), so this only returns the venue
// fallback — and only for a PAID event with a real venue slug. venueId is the
// orphaned venue_id UUID when no venue row joined; a free event shouldn't inherit
// a box-office link. Skips the DB read entirely in those cases.
export async function getVenueTicketUrl(listing: Listing): Promise<string | undefined> {
  if (listing.ticketUrl || listing.isFree || !listing.venueId || UUID_RE.test(listing.venueId)) {
    return undefined;
  }
  return (await getVenueBySlugAsync(listing.venueId))?.ticketUrl;
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
    const venueRows = (rows ?? []) as DbListingRow[];
    const firstSeen = seriesFirstSeen(venueRows);
    const fromDb = venueRows.map((r) =>
      rowToListing(r, venueMap, firstSeen.get(seriesBaseKey(r.source, r.source_id))),
    );
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
  /** Upcoming events at this venue, carrying just the fields the browse-grid
   *  filters need: the date window (for the "time" filter) and lifestyle tags
   *  (for the outdoor/dog-friendly/etc. filters). Length === upcomingCount. */
  upcoming: VenueUpcomingEvent[];
  /** Sum of save_count across the venue's published listings ("Most saved"). */
  saveCount: number;
  /** Denormalized venue_follows count ("Most followed"). */
  followerCount: number;
}

export interface VenueUpcomingEvent {
  startAt: string | null;
  endAt: string | null;
  tags: string[];
}

// Real venues (from ingestion), sorted by activity. Powers the /venues browse
// grid. Counts use the same "today UTC" cutoff as the explore feed so "upcoming"
// means the same thing everywhere. By default only venues with at least one
// upcoming listing are returned; pass { includeEmpty: true } to also get venues
// with zero upcoming events (used by the "My Venues" / has-upcoming filter).
export async function getBrowseVenues(
  opts: { includeEmpty?: boolean } = {},
): Promise<BrowseVenue[]> {
  try {
    const client = await getSupabaseServerClient();
    const cutoff = denverStartOfTodayISO();

    // Both listings aggregations can exceed PostgREST's 1000-row cap (saves
    // covers every published listing, ever), so page through them — a single
    // query would silently drop the tail and undercount. Kept separate from the
    // upcoming query because that one carries different columns + the date predicate.
    const [venuesRes, upcomingRows, savesRows] = await Promise.all([
      client.from("venues").select("id, slug, name, description, address, neighborhood, categories, follower_count"),
      selectAllPaged<{
        venue_id: string | null; date_start: string | null; date_end: string | null; tags: string[] | null;
      }>((from, to) =>
        client
          .from("listings")
          .select("venue_id, date_start, date_end, tags")
          .not("published_at", "is", null)
          .not("venue_id", "is", null)
          // Match getPublishedListings exactly: an ongoing run (end today-or-later)
          // or a future single-date event. Keeps the venue count in step with the
          // explore feed so a mid-run event isn't shown but uncounted.
          .or(`date_end.gte.${cutoff},and(date_end.is.null,date_start.gte.${cutoff})`)
          .order("id", { ascending: true })
          .range(from, to),
      ),
      // Total saves across each venue's published listings (past included) — the
      // "Most saved" popularity signal. RLS-safe: save_count rides on listings.
      selectAllPaged<{ venue_id: string | null; save_count: number | null }>((from, to) =>
        client
          .from("listings")
          .select("venue_id, save_count")
          .not("published_at", "is", null)
          .not("venue_id", "is", null)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);

    const upcomingByVenue = new Map<string, VenueUpcomingEvent[]>();
    for (const r of upcomingRows) {
      if (!r.venue_id) continue;
      const list = upcomingByVenue.get(r.venue_id) ?? [];
      list.push({ startAt: r.date_start, endAt: r.date_end, tags: r.tags ?? [] });
      upcomingByVenue.set(r.venue_id, list);
    }

    const saves = new Map<string, number>();
    for (const r of savesRows) {
      if (!r.venue_id) continue;
      saves.set(r.venue_id, (saves.get(r.venue_id) ?? 0) + (r.save_count ?? 0));
    }

    const out: BrowseVenue[] = [];
    for (const v of (venuesRes.data ?? []) as Array<{
      id: string; slug: string; name: string; description: string | null; address: string | null;
      neighborhood: string | null; categories: string[] | null; follower_count: number | null;
    }>) {
      // Drop ingestion placeholders ("<UNKNOWN>", or any blank-named row) — they
      // are not real venues and shouldn't appear in the browse grid.
      const name = (v.name ?? "").trim();
      if (!name || name === "<UNKNOWN>") continue;
      const upcoming = upcomingByVenue.get(v.id) ?? [];
      const upcomingCount = upcoming.length;
      if (upcomingCount === 0 && !opts.includeEmpty) continue;
      out.push({
        slug: v.slug,
        name: v.name,
        description: v.description ?? "",
        address: v.address ?? "",
        neighborhood: v.neighborhood ?? "",
        categories: v.categories ?? [],
        upcomingCount,
        upcoming,
        saveCount: saves.get(v.id) ?? 0,
        followerCount: v.follower_count ?? 0,
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

