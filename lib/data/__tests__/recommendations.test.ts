import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/types";
import { scoreListing, rankForYou } from "@/lib/data/recommendations";
import { parseSearchParams } from "@/lib/filters/parseSearchParams";

function listing(over: Partial<Listing>): Listing {
  return {
    id: over.id ?? "x", slug: "x", type: "event", title: "x", description: "",
    venueId: "", venueName: "", address: "", neighborhood: over.neighborhood ?? "",
    category: over.category ?? "", startAt: "2026-06-10T00:00:00Z", endAt: null,
    dateDisplay: "", timeDisplay: "", isFree: false, imageUrl: "", source: "Website",
    tags: over.tags ?? [], lat: null, lng: null,
  };
}

describe("scoreListing", () => {
  // Onboarding ids: interest "concerts" → category "music"; lifestyle
  // "couple" → tag "date-night". Neighborhoods are labels.
  const profile = { interests: ["concerts", "food"], neighborhoods: ["LoDo"], lifestyle: ["couple"] };
  it("maps interest ids to categories and lifestyle ids to tags", () => {
    expect(scoreListing(listing({ category: "Music" }), profile)).toBe(3); // concerts→music
    expect(scoreListing(listing({ category: "Food & Drink" }), profile)).toBe(3); // food→food-drink
    expect(scoreListing(listing({ neighborhood: "LoDo" }), profile)).toBe(3);
    expect(scoreListing(listing({ tags: ["date-night"] }), profile)).toBe(2); // couple→date-night
    expect(scoreListing(listing({ category: "Music", neighborhood: "LoDo", tags: ["date-night"] }), profile)).toBe(8);
  });
  it("scores 0 when nothing overlaps", () => {
    expect(scoreListing(listing({ category: "Sports", neighborhood: "RiNo", tags: ["outdoor"] }), profile)).toBe(0);
  });
  it("foodie lifestyle maps to the food-drink category", () => {
    expect(scoreListing(listing({ category: "Food & Drink" }), { lifestyle: ["foodie"] })).toBe(3);
  });
});

describe("rankForYou", () => {
  it("orders best-first and keeps input order for ties", () => {
    const profile = { interests: ["food"], neighborhoods: [], lifestyle: [] };
    const a = listing({ id: "a", category: "Sports" }); // 0
    const b = listing({ id: "b", category: "Food & Drink" }); // 3
    const c = listing({ id: "c", category: "Sports" }); // 0
    const ranked = rankForYou([a, b, c], profile).map((l) => l.id);
    expect(ranked).toEqual(["b", "a", "c"]);
  });

  it("applies behavioral boosts and drops already-saved listings", () => {
    const profile = { interests: [], neighborhoods: [], lifestyle: [] };
    const followed = { ...listing({ id: "f", category: "Sports" }), venueId: "the-venue" };
    const plain = listing({ id: "p", category: "Sports" });
    const saved = listing({ id: "s", category: "Sports" });
    const behavior = {
      savedIds: new Set(["s"]),
      followedVenues: new Set(["the-venue"]),
      savedCategorySlugs: new Set<string>(),
      savedNeighborhoods: new Set<string>(),
    };
    const ranked = rankForYou([plain, followed, saved], profile, behavior).map((l) => l.id);
    expect(ranked).toEqual(["f", "p"]); // followed-venue boosted to top; saved "s" excluded
  });
});

describe("parseSearchParams view", () => {
  it("accepts for-you and falls back to grid for unknown", () => {
    expect(parseSearchParams({ view: "for-you" }).view).toBe("for-you");
    expect(parseSearchParams({ view: "bogus" }).view).toBe("grid");
  });
});
