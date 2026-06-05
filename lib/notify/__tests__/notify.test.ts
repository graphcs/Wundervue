import { describe, expect, it } from "vitest";
import { canReceive } from "@/lib/notify/types";
import { listingMatchesProfile } from "@/lib/notify/match";

describe("canReceive gating", () => {
  it("basic type: free + insider may receive; respects pref toggle", () => {
    expect(canReceive("monthly_favorites", "free", {})).toBe(true); // default on
    expect(canReceive("monthly_favorites", "insider", {})).toBe(true);
    expect(canReceive("monthly_favorites", "free", { monthly_favorites: false })).toBe(false);
  });

  it("advanced type: Insider only, regardless of pref", () => {
    expect(canReceive("new_drops", "free", { new_drops: true })).toBe(false);
    expect(canReceive("venue_alerts", null, {})).toBe(false);
    expect(canReceive("new_drops", "insider", {})).toBe(true); // default on
    expect(canReceive("new_drops", "insider", { new_drops: false })).toBe(false);
  });
});

describe("listingMatchesProfile", () => {
  const listing = {
    category: "Music",
    neighborhood: "LoDo",
    neighborhoodSlug: "lodo",
    tags: ["date-night"],
  };

  it("matches everything when the user has no prefs set", () => {
    expect(listingMatchesProfile(listing, {})).toBe(true);
  });

  it("matches on category, neighborhood (slug or label), or lifestyle tag", () => {
    expect(listingMatchesProfile(listing, { interests: ["Music"] })).toBe(true);
    expect(listingMatchesProfile(listing, { neighborhoods: ["lodo"] })).toBe(true);
    expect(listingMatchesProfile(listing, { neighborhoods: ["LoDo"] })).toBe(true);
    expect(listingMatchesProfile(listing, { lifestyle: ["date-night"] })).toBe(true);
  });

  it("does not match when prefs are set but none overlap", () => {
    expect(
      listingMatchesProfile(listing, { interests: ["Sports"], neighborhoods: ["rino"], lifestyle: ["outdoor"] }),
    ).toBe(false);
  });
});
