import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import type {
  DbListing,
  DedupAction,
  IngestResult,
  ListingInsert,
  NormalizedListing,
  RawItem,
  SourceConfig,
} from "./types";
import { eventKey, makeSlug } from "./dedup";
import { geocode, reverseGeocode } from "./geocode";
import {
  ancestrySlugs,
  extractAddressCity,
  getRegisteredDynamicCities,
  isCentralDenver,
  isCuratedSlug,
  registerDynamicCities,
  resolveCityFromAddress,
  resolveLocationLabel,
  resolveVenueNameAlias,
  type DynamicCity,
  type LocationRef,
} from "@/lib/data/locations";
import { regionSlugForPoint } from "@/lib/data/denverRegions";
import { findCanonicalSlug } from "./venueCanonical";

let cachedClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  cachedClient = createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export interface VenueRow {
  id: string;
  slug: string;
  name: string;
  address: string;
  neighborhood: string;
  region_slug: string | null;
  city_slug: string | null;
  neighborhood_slug: string | null;
  lat: number | null;
  lng: number | null;
}

const VENUE_COLUMNS =
  "id, slug, name, address, neighborhood, region_slug, city_slug, neighborhood_slug, lat, lng";

// Lightweight in-process cache of (slug, name) for every venue, used by
// resolveOrCreateVenue to canonicalize extracted names against existing rows.
// Loaded once per process; appended to when we create a venue so later lookups
// in the same run see it.
let venueListCache: Array<{ slug: string; name: string }> | null = null;

async function getAllVenuesLite(): Promise<Array<{ slug: string; name: string }>> {
  if (venueListCache) return venueListCache;
  const client = getServiceClient();
  const { data, error } = await client.from("venues").select("slug, name");
  if (error) throw new Error(`venue list load failed: ${error.message}`);
  venueListCache = (data ?? []) as Array<{ slug: string; name: string }>;
  return venueListCache;
}

// Force a reload from the DB (used just before creating a venue so a concurrent
// run's new rows are visible to canonicalization).
async function refreshAllVenuesLite(): Promise<Array<{ slug: string; name: string }>> {
  venueListCache = null;
  return getAllVenuesLite();
}

// Drop the cached venue list so the next resolveOrCreateVenue reloads it. Call
// after anything that deletes/renames venue rows out from under the cache (e.g.
// the venue-merge pass) so later sources in the same process don't canonicalize
// against — or re-create — a row that no longer exists.
export function invalidateVenueCache(): void {
  venueListCache = null;
}

export async function resolveVenue(slug: string | undefined): Promise<VenueRow | null> {
  if (!slug) return null;
  const client = getServiceClient();
  const { data, error } = await client
    .from("venues")
    .select(VENUE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`venue lookup failed for ${slug}: ${error.message}`);
  return (data as VenueRow | null) ?? null;
}

export interface ResolvedLocation {
  neighborhood: string | null;
  region_slug: string | null;
  city_slug: string | null;
  neighborhood_slug: string | null;
}

// Synchronous slug resolution from a row's text signals (no network). The city
// is taken from the ADDRESS — the authoritative signal — rather than the
// free-text neighborhood label, which is an unreliable catch-all (e.g. "Golden"
// stamped on Boulder/Littleton/Morrison venues). Precedence, first match wins:
//   1. venue-name alias (Red Rocks → Morrison, beats its misleading address)
//   2. a Central-Denver neighborhood label (RiNo/LoDo — more specific than the
//      bare "Denver" the address would give)
//   3. the city parsed from the address
//   4. any other label match (a suburb city / region) when there's no address city
// Exported so the location-backfill can re-resolve existing rows the same way.
export function resolveLocationSlugsSync(args: {
  neighborhood: string | null;
  address: string | null;
  venueName?: string | null;
}): ResolvedLocation {
  const labelRef = resolveLocationLabel(args.neighborhood);
  const addrRef = resolveCityFromAddress(args.address);
  // Check the venue name and the address's leading place name ("Red Rocks Park,
  // …") against the alias, so a venue-less listing at Red Rocks still → Morrison.
  const addrPlace = args.address?.split(",")[0] ?? null;
  const aliasRef =
    resolveVenueNameAlias(args.venueName) ?? resolveVenueNameAlias(addrPlace);

  let ref: LocationRef | undefined;
  if (aliasRef) {
    // 1. Known venue whose address misnames its city (Red Rocks → Morrison).
    ref = aliasRef;
  } else if (labelRef && labelRef.level === "neighborhood") {
    // 2. A real neighborhood label is the most specific signal (RiNo, LoDo).
    ref = labelRef;
  } else if (addrRef && addrRef.level === "city") {
    // 3. A suburb city parsed from the address is authoritative — overrides the
    //    unreliable neighborhood label (the "Golden" catch-all).
    ref = addrRef;
  } else if (isCentralDenver(labelRef)) {
    // 4. A Denver address only yields the region; keep a more-specific
    //    Central-Denver label (e.g. the "Downtown" city-group).
    ref = labelRef;
  } else {
    // 5. Fall back to the address region (central-denver for a bare "Denver"),
    //    else any remaining label match.
    ref = addrRef ?? labelRef;
  }

  return toResolved(ref, args.neighborhood);
}

// Build a ResolvedLocation from a node. Never overwrites the text label with a
// region name ("Central Denver") — keeps the fallback when we only resolved to a
// region, so specificity is never lost.
function toResolved(ref: LocationRef | undefined, fallbackLabel: string | null): ResolvedLocation {
  const a = ancestrySlugs(ref);
  return {
    neighborhood:
      ref && ref.level !== "region" ? ref.label : (fallbackLabel ?? ref?.label ?? null),
    region_slug: a.regionSlug,
    city_slug: a.citySlug,
    neighborhood_slug: a.neighborhoodSlug,
  };
}

// Async resolution: the sync core first, then — only if no specific place
// resolved — a reverse-geocode of the pin to the containing municipality.
export async function resolveLocationSlugs(args: {
  neighborhood: string | null;
  address?: string | null;
  venueName?: string | null;
  lat: number | null;
  lng: number | null;
}): Promise<ResolvedLocation> {
  const sync = resolveLocationSlugsSync({
    neighborhood: args.neighborhood,
    address: args.address ?? null,
    venueName: args.venueName ?? null,
  });
  // A specific place (city or neighborhood) is trustworthy. A region-only result
  // (a bare "Denver" address) or nothing — refine from the pin below.
  if (sync.city_slug || sync.neighborhood_slug) return sync;

  if (args.lat != null && args.lng != null) {
    // Auto-add: the address names a real city the curated taxonomy doesn't know
    // and the pin sits inside a metro region polygon → register it as a dynamic
    // metro city and tag the row with it. Out-of-metro pins (no containing
    // polygon, e.g. Aspen) fall through to the reverse-geocode / null path and
    // stay untagged, exactly as before.
    const candidate = extractAddressCity(args.address ?? null);
    // Only auto-add a candidate that looks like a real city name. extractAddressCity's
    // fallback can return a street/suite segment for malformed addresses ("…, Stout
    // Street", "123 Main St CO 80202"); minting a "stout-street" city would be junk.
    if (candidate && !looksLikeStreet(candidate) && !resolveLocationLabel(candidate)) {
      const regionSlug = regionSlugForPoint(args.lat, args.lng);
      if (regionSlug) {
        const added = await ensureMetroCity({
          label: candidate,
          regionSlug,
          lat: args.lat,
          lng: args.lng,
        });
        if (added) {
          return {
            neighborhood: added.label,
            region_slug: added.regionSlug,
            city_slug: added.slug,
            neighborhood_slug: null,
          };
        }
      }
    }

    const rev = await reverseGeocode(args.lat, args.lng);
    if (rev) {
      const ref =
        resolveLocationLabel(rev.neighbourhood) ??
        resolveLocationLabel(rev.suburb) ??
        resolveLocationLabel(rev.city);
      if (ref) return toResolved(ref, ref.label);
    }
  }
  return sync; // all-null slugs, but keeps the original neighborhood label
}

// Shared kebab-case core: lowercase, non-alphanumerics → "-", trim dashes.
function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// kebab-case slug for an auto-discovered city label ("Castle Pines" →
// "castle-pines"). Strips apostrophes first so "O'Brien's" → "obriens"; venue
// slugs (venueSlug) deliberately keep apostrophe punctuation as a dash, so the
// two conventions differ only there.
function slugifyCity(label: string): string {
  return kebab(label.replace(/['’]/g, ""));
}

// True when a parsed "city" segment is really a street/suite/PO-box fragment, so
// the auto-add path can reject it instead of minting a junk metro city.
function looksLikeStreet(s: string): boolean {
  const t = s.trim();
  if (/^\d/.test(t)) return true; // "123 Main St", "1700 Lincoln"
  return /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|cir|circle|way|pkwy|parkway|hwy|highway|ste|suite|unit|apt|fl|floor|pmb|p\.?o\.?)\b/i.test(
    t,
  );
}

/**
 * Insert (or no-op on conflict) a dynamic metro city discovered from an address
 * and register it in-process so the rest of this ingest run resolves it without
 * re-inserting. Returns the city, or null on failure / unslugifiable label.
 */
export async function ensureMetroCity(args: {
  label: string;
  regionSlug: string;
  lat: number;
  lng: number;
}): Promise<DynamicCity | null> {
  const slug = slugifyCity(args.label);
  // Bail if the label is unslugifiable, or if its slug collides with a curated
  // node (e.g. a label that strips to "highland"): registerDynamicCities would
  // drop it anyway, so we'd otherwise write a junk row and mis-tag the listing.
  if (!slug || isCuratedSlug(slug)) return null;
  const client = getServiceClient();
  const { data, error } = await client
    .from("metro_cities")
    .upsert(
      {
        slug,
        label: args.label,
        region_slug: args.regionSlug,
        lat: args.lat,
        lng: args.lng,
        source: "auto",
      },
      { onConflict: "slug" },
    )
    .select("slug, label, region_slug")
    .single();
  if (error || !data) {
    console.error(`[metro_cities] upsert failed for ${slug}:`, error?.message);
    return null;
  }
  const city: DynamicCity = {
    slug: data.slug,
    label: data.label,
    regionSlug: data.region_slug,
  };
  // Visible to the rest of THIS ingest run (later listings in the same city
  // resolve via resolveLocationLabel instead of re-inserting). Site-wide
  // visibility comes from the 5-min cache TTL in dynamicCities.server.ts.
  registerDynamicCities([...getRegisteredDynamicCities(), city]);
  return city;
}

// Human-readable slug for an extracted venue name. Stays stable across re-ingest
// runs (no random tail) so two listings citing the same venue resolve to one row.
//
// `cityHint` is appended as a suffix when provided so two same-named venues in
// different cities ("Mission Ballroom" in Denver vs the hypothetical one in
// Boulder) don't collide on the venues row. Today every caller is Denver-only
// and passes undefined → existing rows keep their unsalted slugs. Pass a hint
// from day one when a non-Denver source comes online.
export function venueSlug(name: string, cityHint?: string): string {
  const slugify = kebab;
  const base = slugify(name).slice(0, 60) || "venue";
  if (!cityHint) return base;
  const citySlug = slugify(cityHint);
  if (!citySlug) return base;
  // Cap the combined length the same as the unsalted form so DB constraints
  // can stay narrow.
  return `${base}-${citySlug}`.slice(0, 60);
}

// Resolve a venue for an incoming listing, in order of preference:
//   1) The source's pre-configured defaultVenueSlug (existing behavior).
//   2) A venue row matching the LLM-extracted venueName's slug.
//   3) A new venue row inserted with geocoded lat/lng from the extracted address.
// Returns null only when there's nothing to anchor on (no default, no
// extracted name+address). Geocoding failures still create the venue row —
// callers can backfill coords later.
//
// `city` is the venue's city/region (e.g. "Denver, CO" or "Boulder, CO"). It's
// used both as a slug salt (so same-name venues in different cities don't
// collide) and as the geocode fallback hint when the address is missing or
// unparseable. When omitted, falls back to "Denver, CO" — match the historical
// single-city assumption for legacy callers, but new sources should pass it.
export async function resolveOrCreateVenue(args: {
  defaultVenueSlug?: string;
  venueName: string | null;
  address: string | null;
  neighborhood: string | null;
  city?: string;
}): Promise<VenueRow | null> {
  if (args.defaultVenueSlug) {
    const venue = await resolveVenue(args.defaultVenueSlug);
    if (!venue) {
      throw new Error(
        `defaultVenueSlug "${args.defaultVenueSlug}" not found in venues table — check source config or seed data`,
      );
    }
    return venue;
  }
  if (!args.venueName) return null;
  const slug = venueSlug(args.venueName, args.city);
  const existing = await resolveVenue(slug);
  if (existing) return existing;

  // Canonicalize: an existing venue may be the same place under a different
  // name/slug (e.g. "Little Blue Pigeon Books" -> seeded "little-blue-pigeon").
  // Match on a normalized key before creating a duplicate row.
  const canonicalSlug = findCanonicalSlug(args.venueName, await getAllVenuesLite());
  if (canonicalSlug && canonicalSlug !== slug) {
    const canonical = await resolveVenue(canonicalSlug);
    if (canonical) return canonical;
  }

  // About to create a new venue. The cache can be stale (a concurrent run, or
  // another warm instance, may have just created a matching venue), and the
  // insert race-recovery below only catches identical slugs. Refresh once from
  // the DB and re-check the canonical key so we don't create a variant
  // duplicate. Bounded cost: one reload per genuinely-new venue.
  const freshCanonicalSlug = findCanonicalSlug(args.venueName, await refreshAllVenuesLite());
  if (freshCanonicalSlug && freshCanonicalSlug !== slug) {
    const canonical = await resolveVenue(freshCanonicalSlug);
    if (canonical) return canonical;
  }
  // The exact slug may also have appeared since our first check.
  const racedExisting = await resolveVenue(slug);
  if (racedExisting) return racedExisting;

  // Try to geocode in this order: full address first (most precise), then a
  // "<venue name>, <city>" fallback for cases where the address is missing or
  // too vague to resolve (e.g. "13th Street, Boulder, CO"). Nominatim has good
  // coverage of named places, so a venue without a street address can still
  // pin to a real point.
  const cityHint = args.city ?? "Denver, CO";
  let coords: Awaited<ReturnType<typeof geocode>> = null;
  if (args.address) coords = await geocode(args.address);
  if (!coords) coords = await geocode(`${args.venueName}, ${cityHint}`);

  // Resolve canonical location slugs from the address (authoritative city),
  // falling back to a reverse-geocode of the pin when text doesn't resolve.
  const loc = await resolveLocationSlugs({
    neighborhood: args.neighborhood,
    address: args.address,
    venueName: args.venueName,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  });

  const client = getServiceClient();
  const { data, error } = await client
    .from("venues")
    .insert({
      slug,
      name: args.venueName,
      address: args.address ?? "",
      neighborhood: loc.neighborhood ?? "",
      region_slug: loc.region_slug,
      city_slug: loc.city_slug,
      neighborhood_slug: loc.neighborhood_slug,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    })
    .select(VENUE_COLUMNS)
    .single();
  if (error) {
    // Most likely cause: a concurrent insert from a parallel ingest already
    // wrote this slug. Re-fetch — that's the row we want to use.
    const racedRow = await resolveVenue(slug);
    if (racedRow) return racedRow;
    console.error(`[venues] insert failed for slug=${slug}`, error);
    return null;
  }
  const created = data as VenueRow;
  // Keep the canonicalization cache current within the run so a later listing
  // citing the same new venue (different phrasing) matches this row.
  if (venueListCache) venueListCache.push({ slug: created.slug, name: created.name });
  return created;
}

// A recurring/ongoing deal (daily happy hour, "now available") has no fixed end,
// so it would fall outside the date-based feed window and never surface. Give it
// a rolling visibility window — start now (if undated), end PERPETUAL_DEAL_DAYS
// out — re-extended on every ingest so it stays live without manual upkeep.
const PERPETUAL_DEAL_DAYS = 60;
function dealVisibilityWindow(n: NormalizedListing): {
  dateStart: string | null;
  dateEnd: string | null;
} {
  const isDeal = n.type === "deal" || n.type === "both";
  // A recurring/ongoing deal gets a rolling visibility window. Ignore any
  // dateEnd the LLM extracted: for an ongoing offering that's just one
  // occurrence's end (e.g. an icsCalendar happy-hour RRULE where each entry
  // carries a single 4–5 PM slot), not the real end of the deal — keeping it
  // would expire a perpetual deal after the next occurrence.
  if (n.recurring && isDeal) {
    const now = Date.now();
    return {
      dateStart: n.dateStart ?? new Date(now).toISOString(),
      dateEnd: new Date(now + PERPETUAL_DEAL_DAYS * 86400000).toISOString(),
    };
  }
  return { dateStart: n.dateStart, dateEnd: n.dateEnd };
}

export function buildListingInsert(args: {
  source: SourceConfig;
  item: RawItem;
  normalized: NormalizedListing;
  venue: VenueRow | null;
}): ListingInsert {
  const { source, item, normalized, venue } = args;
  const { dateStart, dateEnd } = dealVisibilityWindow(normalized);
  const key = eventKey({
    canonicalTitle: normalized.canonicalTitle,
    venueId: venue?.id ?? null,
    // Recurring/ongoing items have a rolling or advancing dateStart (the next
    // occurrence for a weekly event, or "now" for a perpetual deal), so keying
    // the event_key on the day would change it every run and defeat cross-source
    // dedup. Key recurring items on title+venue only; reserve the day for one-offs.
    dateStart: normalized.recurring ? null : dateStart,
  });
  // Prefer the venue's pre-resolved slugs (it already parsed its address /
  // reverse-geocoded). For a venue-less listing, resolve from its own address
  // (authoritative city) + label, not the catch-all neighborhood label alone.
  const resolved: ResolvedLocation =
    venue && (venue.region_slug || venue.city_slug || venue.neighborhood_slug)
      ? {
          neighborhood: venue.neighborhood || normalized.neighborhood || null,
          region_slug: venue.region_slug,
          city_slug: venue.city_slug,
          neighborhood_slug: venue.neighborhood_slug,
        }
      : resolveLocationSlugsSync({
          neighborhood: venue?.neighborhood || normalized.neighborhood || null,
          address: venue?.address ?? normalized.address ?? null,
          venueName: normalized.venueName ?? null,
        });
  const neighborhood = resolved.neighborhood;
  const ancestry = {
    regionSlug: resolved.region_slug,
    citySlug: resolved.city_slug,
    neighborhoodSlug: resolved.neighborhood_slug,
  };
  return {
    slug: makeSlug(normalized.title, `${source.sourceLabel}:${item.sourceId}`),
    type: normalized.type,
    title: normalized.title,
    description: normalized.description,
    venue_id: venue?.id ?? null,
    address: venue?.address ?? normalized.address ?? null,
    neighborhood,
    region_slug: ancestry.regionSlug,
    city_slug: ancestry.citySlug,
    neighborhood_slug: ancestry.neighborhoodSlug,
    category: normalized.category || source.defaultCategory || null,
    date_start: dateStart,
    date_end: dateEnd,
    date_display: normalized.dateDisplay || null,
    time_display: normalized.timeDisplay || null,
    is_free: normalized.isFree,
    deal_value: normalized.dealValue,
    image_url: item.imageUrl ?? null,
    image_source: null,
    source: source.sourceLabel,
    source_url: item.sourceUrl ?? null,
    source_id: item.sourceId,
    event_key: key,
    dedup_of: null,
    tags: normalized.tags,
    lat: venue?.lat ?? null,
    lng: venue?.lng ?? null,
    published_at: new Date().toISOString(),
  };
}

interface ExistingRow {
  id: string;
  source: string;
  source_id: string;
  event_key: string;
  dedup_of: string | null;
  published_at: string | null;
}

export async function classifyForUpsert(rows: ListingInsert[]): Promise<DedupAction[]> {
  if (rows.length === 0) return [];
  const client = getServiceClient();

  // Same-source lookup: existing rows with matching (source, source_id).
  // Filter by source as well — without it, an Instagram shortcode or a
  // venue-defaulted slug could pull a row from a different source that
  // happens to share the same source_id string. Each connector batch is
  // single-source today; if that ever changes, the loop below issues one
  // query per distinct source rather than mixing them.
  const idsBySource = new Map<string, string[]>();
  for (const r of rows) {
    const arr = idsBySource.get(r.source) ?? [];
    arr.push(r.source_id);
    idsBySource.set(r.source, arr);
  }

  const sameMap = new Map<string, ExistingRow>();
  for (const [sourceLabel, ids] of idsBySource) {
    const { data, error } = await client
      .from("listings")
      .select("id, source, source_id, event_key, dedup_of, published_at")
      .eq("source", sourceLabel)
      .in("source_id", ids);
    if (error) throw new Error(`existing-same lookup failed: ${error.message}`);
    for (const row of (data ?? []) as ExistingRow[]) {
      sameMap.set(`${row.source}|${row.source_id}`, row);
    }
  }

  // event_key lookup: any published row with a matching event_key is a
  // duplicate of this incoming row, whether it came from a different source
  // or from the same source under a different source_id (e.g. when an
  // upstream connector emits two distinct ids for the same logical event).
  const eventKeys = rows.map((r) => r.event_key);
  const { data: existingByKey, error: e2 } = await client
    .from("listings")
    .select("id, source, source_id, event_key, dedup_of, published_at")
    .in("event_key", eventKeys);
  if (e2) throw new Error(`existing-by-key lookup failed: ${e2.message}`);

  const byKeyMap = new Map<string, ExistingRow>();
  for (const row of (existingByKey ?? []) as ExistingRow[]) {
    if (row.published_at !== null) byKeyMap.set(row.event_key, row);
  }

  return rows.map((row): DedupAction => {
    const sameKey = `${row.source}|${row.source_id}`;
    const sameMatch = sameMap.get(sameKey);
    if (sameMatch) {
      // Preserve existing dedup state across re-ingest. A row that was hidden
      // by a prior skip-duplicate or LLM-cluster pass carries dedup_of set
      // and published_at null; the freshly-built row from buildListingInsert
      // would otherwise overwrite both, silently un-hiding the duplicate on
      // the next cron tick. The FK is `on delete set null`, so when the
      // canonical is deleted dedup_of becomes null naturally and the row
      // re-publishes on the next ingest — desired.
      const preservedRow = sameMatch.dedup_of
        ? { ...row, published_at: null, dedup_of: sameMatch.dedup_of }
        : row;
      return { kind: "update", row: preservedRow, existingId: sameMatch.id };
    }
    const crossMatch = byKeyMap.get(row.event_key);
    if (crossMatch) {
      // Same source produced a new source_id for a row that already exists
      // under an old source_id (most often a connector keying algorithm
      // change). Merging into the canonical preserves its id (and any
      // dedup_of pointers from other rows) while refreshing content and
      // adopting the new source_id format.
      if (crossMatch.source === row.source) {
        return { kind: "merge", row, existingId: crossMatch.id };
      }
      // Different source reporting the same event — first-write-wins;
      // the new row gets hidden under the canonical.
      return {
        kind: "skip-duplicate",
        row: { ...row, published_at: null, dedup_of: crossMatch.id },
        canonicalId: crossMatch.id,
      };
    }
    return { kind: "insert", row };
  });
}

export async function applyBatch(actions: DedupAction[]): Promise<{
  inserted: number;
  updated: number;
  duplicate: number;
}> {
  if (actions.length === 0) return { inserted: 0, updated: 0, duplicate: 0 };
  const client = getServiceClient();

  // Merge actions need an id-based UPDATE — the upsert path keys on
  // (source, source_id), and a merge by definition is rewriting source_id
  // on the canonical row, so onConflict can't find it. Process those
  // separately. The remaining actions go through the bulk upsert.
  const merges = actions.filter((a): a is Extract<DedupAction, { kind: "merge" }> =>
    a.kind === "merge",
  );
  const upsertable = actions.filter((a) => a.kind !== "merge");

  if (upsertable.length > 0) {
    const toUpsert = upsertable.map((a) => a.row);
    const { error } = await client
      .from("listings")
      .upsert(toUpsert, { onConflict: "source,source_id" });
    if (error) throw new Error(`upsert failed: ${error.message}`);
  }

  for (const m of merges) {
    const { error } = await client
      .from("listings")
      .update(m.row)
      .eq("id", m.existingId);
    if (error) throw new Error(`merge update failed for ${m.existingId}: ${error.message}`);
  }

  let inserted = 0;
  let updated = 0;
  let duplicate = 0;
  for (const a of actions) {
    if (a.kind === "insert") inserted++;
    else if (a.kind === "update" || a.kind === "merge") updated++;
    else duplicate++;
  }
  return { inserted, updated, duplicate };
}

export async function startRun(sourceId: string, attempt: number): Promise<string> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("source_runs")
    .insert({ source_id: sourceId, status: "running", attempt })
    .select("id")
    .single();
  if (error) throw new Error(`start run failed: ${error.message}`);
  return (data as { id: string }).id;
}

export async function finishRun(runId: string, result: IngestResult): Promise<void> {
  const client = getServiceClient();
  const { error } = await client
    .from("source_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: result.status,
      items_seen: result.itemsSeen,
      items_inserted: result.itemsInserted,
      items_updated: result.itemsUpdated,
      items_duplicate: result.itemsDuplicate,
      error: result.error ?? null,
    })
    .eq("id", runId);
  if (error) throw new Error(`finish run failed: ${error.message}`);
}

// Insert a fresh row marked status='failed' when the normal finishRun UPDATE
// path itself fails (e.g. the original 'running' row is stuck because the
// post-work write blew up). Without this, recentFailureStreak would only
// trip the auto-disable guard once the original row aged past
// STALE_RUNNING_MS (1h) — leaving a window where a hard-broken source keeps
// retrying every cron tick. With the sentinel, the streak guard sees a
// failure on the next run regardless of whether the original row ever
// finishes its UPDATE.
export async function writeFailedRunSentinel(
  sourceId: string,
  attempt: number,
  reason: string,
): Promise<void> {
  const client = getServiceClient();
  const now = new Date().toISOString();
  const { error } = await client.from("source_runs").insert({
    source_id: sourceId,
    status: "failed",
    attempt,
    started_at: now,
    finished_at: now,
    error: reason,
  });
  if (error) throw new Error(`failed-run sentinel insert failed: ${error.message}`);
}

// 1h: Vercel caps these routes at 300s, so any run still 'running' an hour
// later has crashed. The 1h buffer (vs the 300s cap) absorbs clock skew
// between Vercel and Postgres without false positives on legitimate slow
// runs. The sentinel-row path in writeFailedRunSentinel is belt-and-braces
// for the same failure: without it, a finishRun UPDATE failure would only
// surface to the streak guard once the running row aged past this floor.
const STALE_RUNNING_MS = 60 * 60 * 1000;

export async function recentFailureStreak(sourceId: string): Promise<number> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("source_runs")
    .select("status, started_at")
    .eq("source_id", sourceId)
    .order("started_at", { ascending: false })
    .limit(3);
  if (error) throw new Error(`recent-runs lookup failed: ${error.message}`);
  const now = Date.now();
  let streak = 0;
  for (const row of (data ?? []) as Array<{ status: string; started_at: string }>) {
    if (row.status === "failed") {
      streak++;
      continue;
    }
    // Treat a stuck 'running' row as a failure so a crash that never reached
    // finishRun doesn't hide preceding failures from the auto-disable guard.
    if (row.status === "running") {
      const started = Date.parse(row.started_at);
      if (Number.isFinite(started) && now - started > STALE_RUNNING_MS) {
        streak++;
        continue;
      }
    }
    break;
  }
  return streak;
}

export type { DbListing };
