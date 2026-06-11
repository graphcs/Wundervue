import { getServiceClient, invalidateVenueCache } from "./persist";
import { canonicalKey, significantTokens } from "./venueCanonical";

// Venue de-duplication. The same physical place can end up as several venue rows
// — name variants that canonicalKey() can't bridge ("The Outpost on Platte" vs
// "Station 26 Brewing - The Outpost on Platte"), seed/race conflicts, or bad
// geocodes. That fragmentation is the root cause of cross-source EVENT
// duplicates: the same show pinned to different venue rows escapes the
// same-day/same-venue dedup passes. This pass merges rows that are confidently
// the same place, repoints their listings onto one canonical row, and removes
// the emptied duplicates — so the existing dedup can then collapse the events.

// Coord thresholds (metres). Same-place for the location-variant rule; conflict
// distance beyond which same-key rows are treated as distinct (a chain).
const COORD_SAME_M = 100;
const COORD_CONFLICT_M = 200;

// Tokens that only ever QUALIFY a venue name with a location, never introduce a
// distinct place: Denver-metro cities and neighborhoods, directionals, "denver".
// The location-variant rule merges "Wax Trax" into "Wax Trax Denver" but refuses
// "Union Station" into "Cooper Lounge at Union Station" (cooper/lounge aren't
// here), so a sub-venue inside a shared building is never absorbed into it.
const LOCATION_QUALIFIERS = new Set([
  "denver", "colorado", "co", "metro", "greater", "area",
  // metro cities
  "lakewood", "edgewater", "aurora", "arvada", "englewood", "littleton", "golden",
  "wheat", "ridge", "commerce", "westminster", "thornton", "broomfield", "centennial",
  "parker", "glendale", "lafayette", "louisville", "superior", "brighton", "boulder",
  // Denver neighborhoods + directionals
  "lohi", "rino", "highland", "highlands", "berkeley", "sunnyside", "ballpark", "lodo",
  "uptown", "downtown", "capitol", "hill", "cheesman", "congress", "baker", "platte",
  "washington", "virginia", "cherry", "creek", "sloan", "sloans", "lake", "jefferson",
  "stapleton", "civic", "center", "triangle", "five", "points", "speer", "west", "east",
  "north", "south", "central", "old", "olde", "town", "park", "village", "valley",
]);

export interface VenueLite {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function metresApart(a: VenueLite, b: VenueLite): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  return haversineM(a.lat, a.lng, b.lat, b.lng);
}

// Two rows CONFLICT on location only when both have coords AND they're far apart
// — that's a same-named chain (two "Snooze" locations), never to be merged.
function coordsConflict(a: VenueLite, b: VenueLite): boolean {
  const d = metresApart(a, b);
  return d != null && d > COORD_CONFLICT_M;
}

// One name is the other plus only LOCATION qualifiers — "Wax Trax" vs "Wax Trax
// Denver", "Sloan's Lake" vs "Sloan's Lake Park". The smaller name (>= 2 tokens)
// must be fully contained in the larger, and every EXTRA token in the larger
// must be a location qualifier (or a stray single char like the "s" from a
// possessive). That excludes sub-venues whose extra tokens are distinct proper
// nouns ("Galleria", "Cooper Lounge", "Cantina", "Daniels Hall").
function isLocationVariant(a: VenueLite, b: VenueLite): boolean {
  const ta = significantTokens(a.name);
  const tb = significantTokens(b.name);
  const [small, large] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (small.length < 2) return false;
  const smallSet = new Set(small);
  if (!small.every((t) => large.includes(t))) return false; // subset
  const extra = large.filter((t) => !smallSet.has(t));
  if (extra.length === 0) return false; // identical → Rule 1 handles it
  return extra.every((t) => t.length <= 1 || LOCATION_QUALIFIERS.has(t));
}

// Group venues that are confidently the same place (union-find over two rules).
export function findVenueMergeGroups(venues: VenueLite[]): VenueLite[][] {
  const parent = new Map<string, string>();
  for (const v of venues) parent.set(v.id, v.id);
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (parent.get(x) !== r) {
      const next = parent.get(x)!;
      parent.set(x, r);
      x = next;
    }
    return r;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));

  // Rule 1: identical canonicalKey and not coord-conflicting.
  const byKey = new Map<string, VenueLite[]>();
  for (const v of venues) {
    const k = canonicalKey(v.name);
    if (!k) continue;
    const arr = byKey.get(k) ?? [];
    arr.push(v);
    byKey.set(k, arr);
  }
  for (const grp of byKey.values()) {
    for (let i = 0; i < grp.length; i++)
      for (let j = i + 1; j < grp.length; j++)
        if (!coordsConflict(grp[i], grp[j])) union(grp[i].id, grp[j].id);
  }

  // Rule 2: one name is the other plus only location qualifiers AND coords are
  // within COORD_SAME_M (same point) — catches "-Denver"/neighborhood suffix
  // variants canonicalKey can't bridge, without absorbing distinct sub-venues.
  const withCoords = venues.filter((v) => v.lat != null && v.lng != null);
  for (let i = 0; i < withCoords.length; i++)
    for (let j = i + 1; j < withCoords.length; j++) {
      const a = withCoords[i];
      const b = withCoords[j];
      const d = metresApart(a, b);
      if (d != null && d <= COORD_SAME_M && isLocationVariant(a, b)) union(a.id, b.id);
    }

  const groups = new Map<string, VenueLite[]>();
  for (const v of venues) {
    const r = find(v.id);
    const arr = groups.get(r) ?? [];
    arr.push(v);
    groups.set(r, arr);
  }
  return [...groups.values()].filter((g) => g.length >= 2);
}

// Score for choosing a group's canonical row (highest wins): prefer a real
// street address, then coordinates, then the most listings, then the most
// significant name tokens (most specific name).
function isRealAddress(a: string | null): boolean {
  return !!a && a.trim() !== "" && !/unknown/i.test(a) && /\d/.test(a);
}

export interface VenueMergeResult {
  groups: number;
  venuesRemoved: number;
  listingsRepointed: number;
  // Surviving canonical venue ids for groups actually merged (so callers can
  // re-dedup events now living on them). Empty on a dry run.
  canonicalIds: string[];
  merges: Array<{ canonical: string; absorbed: string[]; listings: number }>;
}

// Merge duplicate venue rows. `onlyVenueIds` limits action to groups that touch
// those venues (per-batch use); omit it to sweep every group (one-time cleanup).
// `dryRun` computes and returns the merges without writing.
export async function mergeDuplicateVenues(
  opts: { onlyVenueIds?: string[]; dryRun?: boolean } = {},
): Promise<VenueMergeResult> {
  const client = getServiceClient();
  const { data, error } = await client.from("venues").select("id, slug, name, address, lat, lng");
  if (error) throw new Error(`venue load failed: ${error.message}`);
  const venues = (data ?? []) as VenueLite[];

  let groups = findVenueMergeGroups(venues);
  if (opts.onlyVenueIds) {
    const touched = new Set(opts.onlyVenueIds);
    groups = groups.filter((g) => g.some((v) => touched.has(v.id)));
  }

  const result: VenueMergeResult = {
    groups: groups.length,
    venuesRemoved: 0,
    listingsRepointed: 0,
    canonicalIds: [],
    merges: [],
  };
  if (groups.length === 0) return result;

  // Listing counts for every candidate venue in ONE query (vs a COUNT per venue
  // in a loop). Used only to pick the canonical row and report the move size —
  // the repoint below runs unconditionally, so an undercount can't orphan rows.
  const counts = new Map<string, number>();
  const candidateIds = [...new Set(groups.flatMap((g) => g.map((v) => v.id)))];
  const { data: lrows, error: cErr } = await client
    .from("listings")
    .select("venue_id")
    .in("venue_id", candidateIds);
  if (cErr) throw new Error(`venue-merge listing count failed: ${cErr.message}`);
  for (const r of (lrows ?? []) as Array<{ venue_id: string }>) {
    counts.set(r.venue_id, (counts.get(r.venue_id) ?? 0) + 1);
  }

  for (const group of groups) {
    const canonical = [...group].sort((a, b) => {
      const ar = Number(isRealAddress(a.address));
      const br = Number(isRealAddress(b.address));
      if (ar !== br) return br - ar;
      const ac = Number(a.lat != null);
      const bc = Number(b.lat != null);
      if (ac !== bc) return bc - ac;
      const al = counts.get(a.id) ?? 0;
      const bl = counts.get(b.id) ?? 0;
      if (al !== bl) return bl - al;
      return significantTokens(b.name).length - significantTokens(a.name).length;
    })[0];

    const absorbed = group.filter((v) => v.id !== canonical.id);
    const listings = absorbed.reduce((n, v) => n + (counts.get(v.id) ?? 0), 0);
    result.merges.push({
      canonical: canonical.slug,
      absorbed: absorbed.map((v) => v.slug),
      listings,
    });

    if (opts.dryRun) continue;

    result.canonicalIds.push(canonical.id);
    for (const v of absorbed) {
      // Repoint unconditionally — a no-op when v has no listings, and correct even
      // if the batched count above undercounted (so we never delete a venue while
      // listings still point at it).
      const { error: upErr } = await client
        .from("listings")
        .update({ venue_id: canonical.id })
        .eq("venue_id", v.id);
      if (upErr) throw new Error(`repoint listings ${v.slug}->${canonical.slug} failed: ${upErr.message}`);
      const { error: delErr } = await client.from("venues").delete().eq("id", v.id);
      if (delErr) throw new Error(`delete venue ${v.slug} failed: ${delErr.message}`);
    }
    result.venuesRemoved += absorbed.length;
    result.listingsRepointed += listings;
  }

  // Venue rows were deleted out from under persist.ts's in-process cache; drop it
  // so later sources in this run don't canonicalize against (or re-create) them.
  if (result.venuesRemoved > 0) invalidateVenueCache();

  return result;
}
