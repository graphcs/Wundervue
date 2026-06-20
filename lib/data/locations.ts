// Canonical Wundervue location taxonomy.
//
// Source of truth: the "Areas" tab of the Wundervue Data Sources sheet and the
// "Wundervue Denver Regions" Google My Map. The hierarchy is four levels:
//
//   Area (Denver Metro) → Region → City → Neighborhood (optional)
//
// Only Central Denver carries a neighborhood breakdown. Every other region
// stops at the city level (neighborhoods: []). Filter/UI code MUST handle the
// empty-neighborhood case — a city with no children is itself the leaf.
//
// Slugs are stable, globally unique kebab-case identifiers. Do not renumber or
// rename them once shipped: they back the *_id columns on listings/venues/
// profiles. Add new entries instead.

export type LocationLevel = "area" | "region" | "city" | "neighborhood";

export interface NeighborhoodNode {
  slug: string;
  label: string;
}

export interface CityNode {
  slug: string;
  label: string;
  /** Empty for suburb cities that have no neighborhood breakdown. */
  neighborhoods: NeighborhoodNode[];
}

export interface RegionNode {
  slug: string;
  label: string;
  cities: CityNode[];
}

export interface AreaNode {
  slug: string;
  label: string;
  regions: RegionNode[];
}

const nb = (slug: string, label: string): NeighborhoodNode => ({ slug, label });

export const LOCATIONS: AreaNode[] = [
  {
    slug: "denver-metro",
    label: "Denver Metro",
    regions: [
      {
        slug: "central-denver",
        label: "Central Denver",
        cities: [
          {
            slug: "downtown",
            label: "Downtown",
            neighborhoods: [
              nb("lodo", "LoDo"),
              nb("union-station", "Union Station"),
              nb("cbd", "Central Business District (CBD)"),
              nb("arapahoe-square", "Arapahoe Square"),
            ],
          },
          {
            slug: "five-points-area",
            label: "Five Points Area",
            neighborhoods: [
              nb("rino", "RiNo"),
              nb("curtis-park", "Curtis Park"),
              nb("five-points", "Five Points"),
              nb("cole", "Cole"),
              nb("whittier", "Whittier"),
            ],
          },
          {
            slug: "capitol-hill-area",
            label: "Capitol Hill Area",
            neighborhoods: [
              nb("capitol-hill", "Capitol Hill"),
              nb("uptown", "Uptown (North Capitol Hill)"),
              nb("cheesman-park", "Cheesman Park"),
              nb("alamo-placita", "Alamo Placita"),
            ],
          },
          {
            slug: "cherry-creek-area",
            label: "Cherry Creek Area",
            neighborhoods: [
              nb("cherry-creek", "Cherry Creek"),
              nb("country-club", "Country Club"),
              nb("belcaro", "Belcaro"),
            ],
          },
          {
            slug: "central-south",
            label: "Central-South",
            neighborhoods: [
              nb("wash-park", "Washington Park (Wash Park)"),
              nb("wash-park-west", "Washington Park West"),
              nb("baker", "Baker"),
              nb("platt-park", "Platt Park"),
              nb("speer", "Speer"),
              nb("cory-merrill", "Cory-Merrill"),
            ],
          },
          {
            slug: "city-park-area",
            label: "City Park Area",
            neighborhoods: [
              nb("city-park", "City Park"),
              nb("congress-park", "Congress Park"),
              nb("hale", "Hale"),
              nb("park-hill", "Park Hill"),
            ],
          },
          {
            slug: "the-highlands",
            label: "The Highlands",
            neighborhoods: [
              nb("lohi", "LoHi"),
              nb("west-highland", "West Highland"),
              nb("jefferson-park", "Jefferson Park"),
              nb("highland", "Highland"),
              nb("sun-valley", "Sun Valley"), // Platte-side area by Mile High/Elitch
            ],
          },
          {
            slug: "lakes-area",
            label: "Lakes Area",
            neighborhoods: [
              nb("sloans-lake", "Sloan's Lake"),
              nb("berkeley", "Berkeley"),
              nb("sunnyside", "Sunnyside"),
              nb("regis", "Regis"),
              nb("chaffee-park", "Chaffee Park"),
            ],
          },
          {
            slug: "university-area",
            label: "University Area",
            neighborhoods: [
              nb("university-du", "University (DU)"),
              nb("university-hills", "University Hills"),
              nb("observatory-park", "Observatory Park"),
              nb("wellshire", "Wellshire"),
            ],
          },
          {
            slug: "central-park-area",
            label: "Central Park Area",
            neighborhoods: [
              nb("central-park", "Central Park"),
              nb("northfield", "Northfield"),
            ],
          },
        ],
      },
      {
        slug: "northwest-denver",
        label: "Northwest Denver",
        cities: [
          { slug: "boulder", label: "Boulder", neighborhoods: [] },
          { slug: "broomfield", label: "Broomfield", neighborhoods: [] },
          { slug: "westminster", label: "Westminster", neighborhoods: [] },
          { slug: "louisville", label: "Louisville", neighborhoods: [] },
          { slug: "lafayette", label: "Lafayette", neighborhoods: [] },
          { slug: "superior", label: "Superior", neighborhoods: [] },
          { slug: "longmont", label: "Longmont", neighborhoods: [] },
          { slug: "erie", label: "Erie", neighborhoods: [] },
          { slug: "lyons", label: "Lyons", neighborhoods: [] },
          { slug: "gunbarrel", label: "Gunbarrel", neighborhoods: [] },
          { slug: "niwot", label: "Niwot", neighborhoods: [] },
        ],
      },
      {
        slug: "west-denver",
        label: "West Denver",
        cities: [
          { slug: "arvada", label: "Arvada", neighborhoods: [] },
          { slug: "golden", label: "Golden", neighborhoods: [] },
          { slug: "wheat-ridge", label: "Wheat Ridge", neighborhoods: [] },
          { slug: "lakewood", label: "Lakewood", neighborhoods: [] },
          { slug: "morrison", label: "Morrison", neighborhoods: [] },
          { slug: "edgewater", label: "Edgewater", neighborhoods: [] },
          { slug: "evergreen", label: "Evergreen", neighborhoods: [] },
        ],
      },
      {
        slug: "southwest-denver",
        label: "Southwest Denver",
        cities: [
          { slug: "littleton", label: "Littleton", neighborhoods: [] },
          { slug: "englewood", label: "Englewood", neighborhoods: [] },
          { slug: "sheridan", label: "Sheridan", neighborhoods: [] },
          { slug: "highlands-ranch", label: "Highlands Ranch", neighborhoods: [] },
        ],
      },
      {
        slug: "southeast-denver",
        label: "Southeast Denver",
        cities: [
          { slug: "centennial", label: "Centennial", neighborhoods: [] },
          { slug: "greenwood-village", label: "Greenwood Village", neighborhoods: [] },
          { slug: "lone-tree", label: "Lone Tree", neighborhoods: [] },
          { slug: "parker", label: "Parker", neighborhoods: [] },
          { slug: "dtc", label: "Denver Tech Center (DTC)", neighborhoods: [] },
          { slug: "aurora", label: "Aurora", neighborhoods: [] },
          { slug: "cherry-hills-village", label: "Cherry Hills Village", neighborhoods: [] },
          { slug: "castle-rock", label: "Castle Rock", neighborhoods: [] },
        ],
      },
      {
        slug: "northeast-denver",
        label: "Northeast Denver",
        cities: [
          { slug: "commerce-city", label: "Commerce City", neighborhoods: [] },
          { slug: "thornton", label: "Thornton", neighborhoods: [] },
          { slug: "northglenn", label: "Northglenn", neighborhoods: [] },
          { slug: "brighton", label: "Brighton", neighborhoods: [] },
          { slug: "far-northeast", label: "Far Northeast", neighborhoods: [] },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Flattened indexes + resolution helpers
// ---------------------------------------------------------------------------

export interface LocationRef {
  level: LocationLevel;
  slug: string;
  label: string;
  /** Parent region slug (set for city + neighborhood). */
  regionSlug?: string;
  /** Parent city slug (set for neighborhood). */
  citySlug?: string;
  areaSlug: string;
}

const BY_SLUG = new Map<string, LocationRef>();
const REGION_REFS: LocationRef[] = [];
const CITY_REFS: LocationRef[] = [];
const NEIGHBORHOOD_REFS: LocationRef[] = [];

for (const area of LOCATIONS) {
  BY_SLUG.set(area.slug, { level: "area", slug: area.slug, label: area.label, areaSlug: area.slug });
  for (const region of area.regions) {
    const regionRef: LocationRef = {
      level: "region",
      slug: region.slug,
      label: region.label,
      areaSlug: area.slug,
    };
    BY_SLUG.set(region.slug, regionRef);
    REGION_REFS.push(regionRef);
    for (const city of region.cities) {
      const cityRef: LocationRef = {
        level: "city",
        slug: city.slug,
        label: city.label,
        regionSlug: region.slug,
        areaSlug: area.slug,
      };
      BY_SLUG.set(city.slug, cityRef);
      CITY_REFS.push(cityRef);
      for (const hood of city.neighborhoods) {
        const hoodRef: LocationRef = {
          level: "neighborhood",
          slug: hood.slug,
          label: hood.label,
          regionSlug: region.slug,
          citySlug: city.slug,
          areaSlug: area.slug,
        };
        BY_SLUG.set(hood.slug, hoodRef);
        NEIGHBORHOOD_REFS.push(hoodRef);
      }
    }
  }
}

export const REGIONS: ReadonlyArray<LocationRef> = REGION_REFS;
export const CITIES: ReadonlyArray<LocationRef> = CITY_REFS;
export const NEIGHBORHOODS_ALL: ReadonlyArray<LocationRef> = NEIGHBORHOOD_REFS;

// A "city group" (Central Denver's "downtown", "five-points-area", …) is an
// organizational layer that holds neighborhoods — a listing sits in one of the
// neighborhoods, not the group. Suburb towns (Boulder, Golden, …) carry no
// neighborhood breakdown and are themselves places.
const CITY_GROUP_SLUGS = new Set(
  LOCATIONS.flatMap((a) => a.regions)
    .flatMap((r) => r.cities)
    .filter((c) => c.neighborhoods.length > 0)
    .map((c) => c.slug),
);
const SUBURB_CITY_REFS = CITY_REFS.filter((c) => !CITY_GROUP_SLUGS.has(c.slug));

// A few city-groups are also well-known browse destinations in their own right
// (a real place name, not just an organizational label) and get an aggregate
// /explore page spanning their neighborhoods. "Downtown" is the canonical one:
// its listings resolve to child neighborhoods (LoDo, CBD, …) that the
// hierarchical filter rolls back up under the group.
const AGGREGATE_PLACE_SLUGS = new Set(["downtown"]);
const AGGREGATE_CITY_REFS = CITY_REFS.filter((c) =>
  AGGREGATE_PLACE_SLUGS.has(c.slug),
);

// Every browsable "place": Central Denver neighborhoods + suburb towns + the
// aggregate city-groups above. Backs the /explore/[place] pages and their slug
// validation. The remaining city-groups ("Five Points Area", …) are excluded —
// they're organizational, not destinations.
export const ALL_PLACES: ReadonlyArray<LocationRef> = [
  ...NEIGHBORHOOD_REFS,
  ...SUBURB_CITY_REFS,
  ...AGGREGATE_CITY_REFS,
];
const PLACE_SLUG_SET = new Set(ALL_PLACES.map((p) => p.slug));

/** True when `slug` names a browsable place (neighborhood, suburb, or aggregate). */
export function isPlaceSlug(slug: string): boolean {
  return PLACE_SLUG_SET.has(slug);
}

// Old flat-taxonomy slugs (lib/data/neighborhoods.ts) that no longer name a
// browsable place after the migration. Redirect them to their closest successor
// so indexed/bookmarked /explore/<slug> URLs keep working instead of 404ing.
const LEGACY_PLACE_REDIRECTS: Record<string, string> = {
  highlands: "lohi", // old aggregate "Highlands" → its flagship neighborhood
};

/** The successor place slug a legacy /explore slug should redirect to, if any. */
export function legacyPlaceRedirect(slug: string): string | undefined {
  return LEGACY_PLACE_REDIRECTS[slug];
}

// The set of place labels the ingest LLM may pick from — the same browsable
// places, by label. Excludes the Central Denver city-group labels ("Five Points
// Area", etc.): those are organizational, not places a listing sits in.
export const LLM_LOCATION_LABELS: string[] = [
  ...NEIGHBORHOOD_REFS.map((n) => n.label),
  ...SUBURB_CITY_REFS.map((c) => c.label),
];

/** Look up any location (area/region/city/neighborhood) by its slug. */
export function locationBySlug(slug: string): LocationRef | undefined {
  return BY_SLUG.get(slug);
}

export interface Ancestry {
  regionSlug: string | null;
  citySlug: string | null;
  neighborhoodSlug: string | null;
}

/**
 * The region/city/neighborhood slugs a node implies, for denormalizing onto a
 * row. A region fills only regionSlug; a city fills region+city; a neighborhood
 * fills all three. Accepts a slug or a resolved LocationRef.
 */
export function ancestrySlugs(slugOrRef: string | LocationRef | undefined): Ancestry {
  const ref = typeof slugOrRef === "string" ? BY_SLUG.get(slugOrRef) : slugOrRef;
  const empty: Ancestry = { regionSlug: null, citySlug: null, neighborhoodSlug: null };
  if (!ref) return empty;
  switch (ref.level) {
    case "neighborhood":
      return { regionSlug: ref.regionSlug ?? null, citySlug: ref.citySlug ?? null, neighborhoodSlug: ref.slug };
    case "city":
      return { regionSlug: ref.regionSlug ?? null, citySlug: ref.slug, neighborhoodSlug: null };
    case "region":
      return { regionSlug: ref.slug, citySlug: null, neighborhoodSlug: null };
    default:
      return empty;
  }
}

// Normalized label → slug, including legacy aliases for the flat strings that
// pre-taxonomy rows already store. Lets resolveLocationLabel() map existing
// listing/venue/profile data onto canonical nodes (used by the backfill).
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[’']/g, "'");
}

const LABEL_TO_SLUG = new Map<string, string>();
for (const ref of [...NEIGHBORHOOD_REFS, ...CITY_REFS, ...REGION_REFS]) {
  LABEL_TO_SLUG.set(norm(ref.label), ref.slug);
}

// Legacy/alias strings → canonical slug. Keys are the flat values used before
// the taxonomy existed (lib/data/neighborhoods.ts) plus common variants.
const LEGACY_ALIASES: Record<string, string> = {
  "highlands": "the-highlands",
  "wash park": "wash-park",
  "washington park": "wash-park",
  "south broadway": "baker", // SoBo corridor runs through Baker; closest leaf
  "sloans lake": "sloans-lake",
  "lohi": "lohi",
  "rino": "rino",
  "cap hill": "capitol-hill",
  "north capitol hill": "uptown",
  "denver tech center": "dtc",
  "central business district": "cbd",
  "red rocks": "morrison", // Red Rocks Amphitheatre sits in Morrison
  "santa fe arts district": "baker", // Art District on Santa Fe → Baker area
  "santa fe art district": "baker",
  "santa fe": "baker", // bare "Santa Fe" in our data is the Art District on Santa Fe
  "downtown louisville": "louisville", // a "Downtown <town>" prefix shouldn't unmatch the town
  "downtown denver": "downtown",
  "denver": "central-denver", // bare "Denver" → the central-denver region (no single city node)
  "north park hill": "park-hill",
  "golden triangle": "cbd", // museum district, borders the CBD
  "montbello": "far-northeast",
  "lincoln park": "baker", // La Alma–Lincoln Park, west of downtown
};
for (const [alias, slug] of Object.entries(LEGACY_ALIASES)) {
  LABEL_TO_SLUG.set(norm(alias), slug);
}

/**
 * Resolve a free-text location label (canonical or legacy) to its node.
 * Returns undefined when nothing matches — callers decide the fallback.
 */
export function resolveLocationLabel(label: string | null | undefined): LocationRef | undefined {
  if (!label) return undefined;
  const slug = LABEL_TO_SLUG.get(norm(label));
  return slug ? BY_SLUG.get(slug) : undefined;
}

// Curated venue-name → city overrides for venues whose street address names the
// wrong municipality. Red Rocks is in Morrison, but Google/USGS list it as
// "Golden, CO" — so the address alone would mistag it. Matched as a substring
// of the normalized venue name.
const VENUE_NAME_CITY_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["red rocks", "morrison"],
];

/** City ref for a known venue whose address misnames its city, else undefined. */
export function resolveVenueNameAlias(name: string | null | undefined): LocationRef | undefined {
  if (!name) return undefined;
  const n = norm(name);
  for (const [needle, slug] of VENUE_NAME_CITY_ALIASES) {
    // Prefix-match only: "Red Rocks Amphitheatre" matches, but a catch-all like
    // "Multiple venues (…, Red Rocks)" must not be dragged to Morrison.
    if (n === needle || n.startsWith(`${needle} `)) return BY_SLUG.get(slug);
  }
  return undefined;
}

/** True when a ref sits in Denver proper (the central-denver region, its
 *  city-groups, or its neighborhoods) — more specific than a bare "Denver". */
export function isCentralDenver(ref: LocationRef | undefined): boolean {
  return !!ref && (ref.regionSlug === "central-denver" || ref.slug === "central-denver");
}

/**
 * The raw city segment of a US street address ("123 Main St, Boulder, CO 80302"
 * → "Boulder"), or undefined when there's no city segment (a bare trailhead).
 * Shared by resolveCityFromAddress and the location backfill's diagnostics so
 * they parse identically.
 */
export function extractAddressCity(address: string | null | undefined): string | undefined {
  if (!address) return undefined;
  const cleaned = address.replace(/,?\s*(USA|United States)\s*\.?\s*$/i, "").trim();
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return undefined; // need at least "<street>, <city>"

  // The city is the segment just before the state token (CO / Colorado, maybe
  // with a trailing ZIP). Scan from the end so a "City, ST ZIP" tail wins.
  for (let i = parts.length - 1; i >= 1; i--) {
    if (/^(co|colorado)\b/i.test(parts[i])) return parts[i - 1];
    // "...Boulder CO 80302" with no comma before the state.
    const m = parts[i].match(/^(.*?)\s+(?:co|colorado)\s+\d{5}(?:-\d{4})?$/i);
    if (m && m[1].trim()) return m[1].trim();
  }
  // No explicit state token — assume the last segment is the city (drop a ZIP).
  return parts[parts.length - 1].replace(/\s+\d{5}(?:-\d{4})?$/, "").trim() || undefined;
}

/**
 * Resolve the city named in a US address to a taxonomy city (or the
 * central-denver region for a bare "Denver", via LEGACY_ALIASES). The address
 * is the authoritative city signal — the free-text neighborhood label is an
 * unreliable catch-all. Returns undefined for city-less addresses or
 * out-of-metro cities not in the taxonomy (Aspen, Idaho Springs).
 */
export function resolveCityFromAddress(address: string | null | undefined): LocationRef | undefined {
  const candidate = extractAddressCity(address);
  if (!candidate) return undefined;
  const ref = resolveLocationLabel(candidate);
  return ref && (ref.level === "city" || ref.level === "region") ? ref : undefined;
}

/**
 * Leaf labels covered by a selection. For a region this is every city +
 * neighborhood under it; for a city, the city plus its neighborhoods; for a
 * neighborhood, just itself. Use this to match against a listing's stored
 * neighborhood/city string before *_id columns are populated everywhere.
 */
export function descendantLabels(slug: string): string[] {
  const ref = BY_SLUG.get(slug);
  if (!ref) return [];
  if (ref.level === "neighborhood") return [ref.label];

  const labels: string[] = [];
  for (const area of LOCATIONS) {
    if (ref.level === "area" && area.slug !== slug) continue;
    for (const region of area.regions) {
      if (ref.level === "region" && region.slug !== slug) continue;
      for (const city of region.cities) {
        if (ref.level === "city" && city.slug !== slug) continue;
        labels.push(city.label);
        for (const hood of city.neighborhoods) labels.push(hood.label);
      }
    }
  }
  return labels;
}

/**
 * Does a listing/venue's free-text location label fall under any of the
 * selected taxonomy slugs? Hierarchical: selecting a region matches every city
 * and neighborhood under it; selecting a city matches its neighborhoods. The
 * label is resolved (incl. legacy aliases) onto its node, then we check the
 * node and its ancestors against the selection.
 */
export function locationMatchesSelection(
  label: string | null | undefined,
  selected: Set<string>,
): boolean {
  if (selected.size === 0) return true;
  const ref = resolveLocationLabel(label);
  if (!ref) return false;
  return (
    selected.has(ref.slug) ||
    (ref.citySlug != null && selected.has(ref.citySlug)) ||
    (ref.regionSlug != null && selected.has(ref.regionSlug)) ||
    selected.has(ref.areaSlug)
  );
}

/** Slugs of all descendant nodes (cities + neighborhoods) under a selection. */
export function descendantSlugs(slug: string): string[] {
  const ref = BY_SLUG.get(slug);
  if (!ref) return [];
  if (ref.level === "neighborhood") return [ref.slug];

  const slugs: string[] = [];
  for (const area of LOCATIONS) {
    if (ref.level === "area" && area.slug !== slug) continue;
    for (const region of area.regions) {
      if (ref.level === "region" && region.slug !== slug) continue;
      for (const city of region.cities) {
        if (ref.level === "city" && city.slug !== slug) continue;
        slugs.push(city.slug);
        for (const hood of city.neighborhoods) slugs.push(hood.slug);
      }
    }
  }
  return slugs;
}
