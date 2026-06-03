import { describe, expect, it } from "vitest";
import {
  CITIES,
  LOCATIONS,
  NEIGHBORHOODS_ALL,
  REGIONS,
  descendantLabels,
  descendantSlugs,
  locationBySlug,
  locationMatchesSelection,
  resolveLocationLabel,
} from "../locations";

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
