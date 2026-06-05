import { describe, expect, it } from "vitest";
import { LIFESTYLE_TAGS } from "@/lib/filters/types";
import { parseSearchParams } from "@/lib/filters/parseSearchParams";

// Guards the taxonomy the card chips, the filter pills, and the URL parser all
// share. If a lifestyle tag is added/renamed, these must move together or cards
// will render unlabeled chips and filters will silently drop the value.
const EXPECTED = ["date-night", "dog-friendly", "family", "outdoor"];

describe("lifestyle tag taxonomy", () => {
  it("LIFESTYLE_TAGS covers exactly the canonical tag set", () => {
    expect(LIFESTYLE_TAGS.map((t) => t.id).sort()).toEqual([...EXPECTED].sort());
  });

  it("every displayed tag has a non-empty label and emoji", () => {
    for (const t of LIFESTYLE_TAGS) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.emoji.length).toBeGreaterThan(0);
    }
  });

  it("the URL parser accepts exactly those tags and drops unknowns", () => {
    const parsed = parseSearchParams({
      lifestyle: [...EXPECTED, "bogus"].join(","),
    });
    expect(parsed.lifestyle.sort()).toEqual([...EXPECTED].sort());
  });
});
