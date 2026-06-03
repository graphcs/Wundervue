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
        ],
      },
      {
        slug: "northeast-denver",
        label: "Northeast Denver",
        cities: [
          { slug: "commerce-city", label: "Commerce City", neighborhoods: [] },
          { slug: "thornton", label: "Thornton", neighborhoods: [] },
          { slug: "northglenn", label: "Northglenn", neighborhoods: [] },
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

// The set of place labels the ingest LLM may pick from: every Central Denver
// neighborhood plus every suburb city (cities with no neighborhood breakdown).
// Excludes the Central Denver city-group labels ("Five Points Area", etc.) —
// those are organizational, not places a listing sits in.
export const LLM_LOCATION_LABELS: string[] = [
  ...NEIGHBORHOOD_REFS.map((n) => n.label),
  ...CITY_REFS.filter((c) => {
    const region = LOCATIONS[0].regions.find((r) => r.slug === c.regionSlug);
    const city = region?.cities.find((cc) => cc.slug === c.slug);
    return (city?.neighborhoods.length ?? 0) === 0;
  }).map((c) => c.label),
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
