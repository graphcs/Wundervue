import { describe, expect, it } from "vitest";
import { DENVER_REGIONS } from "@/lib/data/denverRegions";

describe("DENVER_REGIONS overlay", () => {
  it("is a FeatureCollection of the five mapped region polygons", () => {
    expect(DENVER_REGIONS.type).toBe("FeatureCollection");
    const slugs = DENVER_REGIONS.features.map((f) => f.properties.slug).sort();
    expect(slugs).toEqual(
      ["central-denver", "northeast-denver", "northwest-denver", "southeast-denver", "west-denver"].sort(),
    );
  });

  it("each region is a non-empty closed polygon", () => {
    for (const f of DENVER_REGIONS.features) {
      expect(f.geometry.type).toBe("Polygon");
      const ring = f.geometry.coordinates[0];
      expect(ring.length).toBeGreaterThan(3);
      expect(ring[0]).toEqual(ring[ring.length - 1]); // first === last (closed)
      expect(f.properties.label.length).toBeGreaterThan(0);
    }
  });
});
