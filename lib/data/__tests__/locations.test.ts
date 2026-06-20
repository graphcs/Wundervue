import { afterEach, describe, expect, it } from "vitest";
import {
  CITIES,
  LOCATIONS,
  NEIGHBORHOODS_ALL,
  REGIONS,
  ancestrySlugs,
  descendantLabels,
  descendantSlugs,
  getRegisteredDynamicCities,
  isCuratedSlug,
  isPlaceSlug,
  locationBySlug,
  locationMatchesSelection,
  registerDynamicCities,
  resolveCityFromAddress,
  resolveLocationLabel,
  resolveVenueNameAlias,
} from "../locations";

describe("dynamic cities (auto-added metro cities)", () => {
  const castlePines = {
    slug: "castle-pines",
    label: "Castle Pines",
    regionSlug: "southeast-denver",
  };
  afterEach(() => registerDynamicCities([])); // never leak into other tests

  it("isCuratedSlug distinguishes curated nodes from dynamic cities", () => {
    expect(isCuratedSlug("boulder")).toBe(true); // curated suburb city
    expect(isCuratedSlug("central-denver")).toBe(true); // curated region
    expect(isCuratedSlug("rino")).toBe(true); // curated neighborhood
    registerDynamicCities([castlePines]);
    expect(isCuratedSlug("castle-pines")).toBe(false); // dynamic, not curated
  });

  it("makes an auto-added city resolvable across the taxonomy functions", () => {
    registerDynamicCities([castlePines]);
    expect(isPlaceSlug("castle-pines")).toBe(true);
    expect(locationBySlug("castle-pines")?.label).toBe("Castle Pines");
    expect(resolveLocationLabel("Castle Pines")?.slug).toBe("castle-pines");
    expect(ancestrySlugs("castle-pines")).toEqual({
      regionSlug: "southeast-denver",
      citySlug: "castle-pines",
      neighborhoodSlug: null,
    });
    expect(descendantSlugs("castle-pines")).toEqual(["castle-pines"]);
    expect(descendantLabels("castle-pines")).toEqual(["Castle Pines"]);
  });

  it("rolls a dynamic city up under its region", () => {
    registerDynamicCities([castlePines]);
    expect(descendantSlugs("southeast-denver")).toContain("castle-pines");
    expect(locationMatchesSelection("Castle Pines", new Set(["castle-pines"]))).toBe(true);
    expect(locationMatchesSelection("Castle Pines", new Set(["southeast-denver"]))).toBe(true);
    expect(locationMatchesSelection("Castle Pines", new Set(["northwest-denver"]))).toBe(false);
  });

  it("never shadows a curated slug", () => {
    registerDynamicCities([
      { slug: "boulder", label: "Not Boulder", regionSlug: "southeast-denver" },
    ]);
    expect(locationBySlug("boulder")?.label).toBe("Boulder"); // curated wins
    expect(getRegisteredDynamicCities()).toHaveLength(0);
  });

  it("leaves resolution unchanged when the registry is empty", () => {
    registerDynamicCities([]);
    expect(isPlaceSlug("castle-pines")).toBe(false);
    expect(locationBySlug("castle-pines")).toBeUndefined();
    expect(resolveLocationLabel("Castle Pines")).toBeUndefined();
  });
});

describe("location taxonomy", () => {
  it("has unique slugs across every level", () => {
    const slugs: string[] = [];
    for (const area of LOCATIONS) {
      slugs.push(area.slug);
      for (const region of area.regions) {
        slugs.push(region.slug);
        for (const city of region.cities) {
          slugs.push(city.slug);
          for (const hood of city.neighborhoods) slugs.push(hood.slug);
        }
      }
    }
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("exposes the six Denver Metro regions", () => {
    expect(REGIONS).toHaveLength(6);
    expect(REGIONS.map((r) => r.slug)).toContain("central-denver");
  });

  it("only Central Denver carries neighborhoods", () => {
    const hoodRegions = new Set(NEIGHBORHOODS_ALL.map((n) => n.regionSlug));
    expect([...hoodRegions]).toEqual(["central-denver"]);
  });

  it("resolves canonical and legacy labels onto nodes", () => {
    expect(resolveLocationLabel("RiNo")?.slug).toBe("rino");
    expect(resolveLocationLabel("Wash Park")?.slug).toBe("wash-park");
    expect(resolveLocationLabel("Highlands")?.slug).toBe("the-highlands");
    expect(resolveLocationLabel("Golden")?.slug).toBe("golden");
    expect(resolveLocationLabel("Sloan's Lake")?.slug).toBe("sloans-lake");
    expect(resolveLocationLabel("nowhere-real")).toBeUndefined();
  });

  it("selecting a region covers all its neighborhood labels", () => {
    const labels = descendantLabels("central-denver");
    expect(labels).toContain("RiNo");
    expect(labels).toContain("Baker");
    // a region selection implies its cities too
    expect(labels).toContain("Downtown");
  });

  it("selecting a suburb city resolves to just itself", () => {
    expect(descendantSlugs("golden")).toEqual(["golden"]);
    expect(descendantLabels("golden")).toEqual(["Golden"]);
  });

  it("selecting a neighborhood resolves to just itself", () => {
    expect(descendantSlugs("rino")).toEqual(["rino"]);
    expect(locationBySlug("rino")?.level).toBe("neighborhood");
    expect(locationBySlug("rino")?.citySlug).toBe("five-points-area");
  });

  it("indexes ~60 cities", () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(40);
  });
});

describe("resolveCityFromAddress", () => {
  it("pulls the city out of a full street address", () => {
    expect(resolveCityFromAddress("2205 Broadway, Boulder, CO")?.slug).toBe("boulder");
    expect(resolveCityFromAddress("199 E Littleton Blvd, Littleton, CO 80121")?.slug).toBe(
      "littleton",
    );
    expect(resolveCityFromAddress("8485 Kipling St, Arvada, CO")?.slug).toBe("arvada");
    expect(resolveCityFromAddress("9910 Wadsworth Pkwy, Westminster, CO")?.slug).toBe(
      "westminster",
    );
  });

  it("resolves the cities newly added to the taxonomy", () => {
    expect(resolveCityFromAddress("300 2nd St, Castle Rock, CO")?.slug).toBe("castle-rock");
    expect(resolveCityFromAddress("Main St, Brighton, CO 80601")?.slug).toBe("brighton");
    expect(resolveCityFromAddress("123 Bear Creek, Evergreen, CO")?.slug).toBe("evergreen");
  });

  it("maps a bare Denver address to the central-denver region", () => {
    const ref = resolveCityFromAddress("1700 Lincoln St, Denver, CO 80203");
    expect(ref?.slug).toBe("central-denver");
    expect(ref?.level).toBe("region");
  });

  it("returns undefined for out-of-metro or city-less addresses", () => {
    expect(resolveCityFromAddress("Aspen, CO")).toBeUndefined();
    expect(resolveCityFromAddress("Idaho Springs, CO")).toBeUndefined();
    expect(resolveCityFromAddress("North Table Mountain Trailhead")).toBeUndefined();
    expect(resolveCityFromAddress(null)).toBeUndefined();
  });
});

describe("resolveVenueNameAlias", () => {
  it("maps Red Rocks to Morrison regardless of its misleading address", () => {
    expect(resolveVenueNameAlias("Red Rocks Amphitheatre")?.slug).toBe("morrison");
    expect(resolveVenueNameAlias("Red Rocks Park & Amphitheatre")?.slug).toBe("morrison");
    expect(resolveVenueNameAlias("Ogden Theatre")).toBeUndefined();
    // A catch-all venue that merely mentions Red Rocks must NOT be dragged to Morrison.
    expect(
      resolveVenueNameAlias("Multiple venues (Bluebird Theater, Ogden Theatre, Red Rocks)"),
    ).toBeUndefined();
    expect(resolveVenueNameAlias(null)).toBeUndefined();
  });
});

describe("locationMatchesSelection", () => {
  it("matches everything when nothing is selected", () => {
    expect(locationMatchesSelection("RiNo", new Set())).toBe(true);
  });

  it("matches a neighborhood by its own slug", () => {
    expect(locationMatchesSelection("RiNo", new Set(["rino"]))).toBe(true);
    expect(locationMatchesSelection("Baker", new Set(["rino"]))).toBe(false);
  });

  it("region selection matches descendant neighborhoods", () => {
    // RiNo is in Central Denver → selecting the region matches it.
    expect(locationMatchesSelection("RiNo", new Set(["central-denver"]))).toBe(true);
    // Golden is in West Denver → not matched by Central Denver.
    expect(locationMatchesSelection("Golden", new Set(["central-denver"]))).toBe(false);
    expect(locationMatchesSelection("Golden", new Set(["west-denver"]))).toBe(true);
  });

  it("city selection matches its neighborhoods", () => {
    // RiNo sits under the Five Points Area city group.
    expect(locationMatchesSelection("RiNo", new Set(["five-points-area"]))).toBe(true);
    expect(locationMatchesSelection("LoDo", new Set(["five-points-area"]))).toBe(false);
  });

  it("resolves legacy labels before matching", () => {
    // "Highlands" is a legacy alias for the the-highlands city.
    expect(locationMatchesSelection("Highlands", new Set(["the-highlands"]))).toBe(true);
    expect(locationMatchesSelection("Highlands", new Set(["central-denver"]))).toBe(true);
  });

  it("returns false for an unresolvable label when a selection is active", () => {
    expect(locationMatchesSelection("Atlantis", new Set(["central-denver"]))).toBe(false);
    expect(locationMatchesSelection(null, new Set(["rino"]))).toBe(false);
  });
});
