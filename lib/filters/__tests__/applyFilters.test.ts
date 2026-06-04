import { describe, expect, it } from "vitest";
import { applyFilters } from "../applyFilters";
import type { Filters, Listing, ListingType } from "@/lib/types";

function mk(over: Partial<Listing> & { id: string }): Listing {
  return {
    slug: over.id,
    type: "event" as ListingType,
    title: over.id,
    description: "",
    venueId: "",
    venueName: "",
    address: "",
    neighborhood: "",
    category: "",
    startAt: "2026-07-01T00:00:00Z",
    endAt: null,
    dateDisplay: "",
    timeDisplay: "",
    isFree: false,
    imageUrl: "",
    source: "Website",
    tags: [],
    lat: null,
    lng: null,
    ...over,
  };
}

function filters(over: Partial<Filters> = {}): Filters {
  return {
    type: "all",
    neighborhoods: [],
    categories: [],
    date: "any",
    lifestyle: [],
    freeOnly: false,
    sort: "soonest",
    view: "grid",
    pageSize: 9,
    ...over,
  };
}

const rino = mk({ id: "rino", neighborhood: "RiNo", startAt: "2026-07-03T00:00:00Z" });
const baker = mk({ id: "baker", neighborhood: "Baker", startAt: "2026-07-02T00:00:00Z" });
const golden = mk({ id: "golden", neighborhood: "Golden", startAt: "2026-07-01T00:00:00Z" });
const all = [rino, baker, golden];

const ids = (ls: Listing[]) => ls.map((l) => l.id);

describe("applyFilters — hierarchical location", () => {
  it("returns everything when no location is selected", () => {
    expect(ids(applyFilters(all, filters())).sort()).toEqual(["baker", "golden", "rino"]);
  });

  it("region selection matches all its descendant neighborhoods", () => {
    // RiNo + Baker are Central Denver; Golden is West Denver.
    const out = ids(applyFilters(all, filters({ neighborhoods: ["central-denver"] })));
    expect(out.sort()).toEqual(["baker", "rino"]);
  });

  it("a different region excludes them", () => {
    expect(ids(applyFilters(all, filters({ neighborhoods: ["west-denver"] })))).toEqual(["golden"]);
  });

  it("city selection matches its neighborhoods", () => {
    // RiNo sits under the Five Points Area city group.
    expect(ids(applyFilters(all, filters({ neighborhoods: ["five-points-area"] })))).toEqual(["rino"]);
  });

  it("neighborhood selection matches only that neighborhood", () => {
    expect(ids(applyFilters(all, filters({ neighborhoods: ["rino"] })))).toEqual(["rino"]);
  });
});

describe("applyFilters — type / free / sort integration", () => {
  const ev = mk({ id: "ev", type: "event", startAt: "2026-07-05T00:00:00Z" });
  const deal = mk({ id: "deal", type: "deal", isFree: true, startAt: "2026-07-02T00:00:00Z" });
  const both = mk({ id: "both", type: "both", startAt: "2026-07-03T00:00:00Z" });
  const list = [ev, deal, both];

  it("type=deals includes deal + both", () => {
    expect(ids(applyFilters(list, filters({ type: "deals" }))).sort()).toEqual(["both", "deal"]);
  });

  it("freeOnly keeps only free listings", () => {
    expect(ids(applyFilters(list, filters({ freeOnly: true })))).toEqual(["deal"]);
  });

  it("applies sort (soonest ascending) to the filtered result", () => {
    expect(ids(applyFilters(list, filters({ sort: "soonest" })))).toEqual(["deal", "both", "ev"]);
    expect(ids(applyFilters(list, filters({ sort: "latest" })))).toEqual(["ev", "both", "deal"]);
  });
});
