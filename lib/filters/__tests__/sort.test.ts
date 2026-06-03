import { describe, expect, it } from "vitest";
import { sortListings } from "../applyFilters";
import type { Listing } from "@/lib/types";

function mk(id: string, startAt: string): Listing {
  return {
    id,
    slug: id,
    type: "event",
    title: id,
    description: "",
    venueId: "",
    venueName: "",
    address: "",
    neighborhood: "",
    category: "",
    startAt,
    endAt: null,
    dateDisplay: "",
    timeDisplay: "",
    isFree: false,
    imageUrl: "",
    source: "Website",
    tags: [],
    lat: null,
    lng: null,
  };
}

const a = mk("a", "2026-06-10T00:00:00Z");
const b = mk("b", "2026-06-05T00:00:00Z");
const c = mk("c", "2026-06-20T00:00:00Z");
const noDate = mk("nodate", "");

describe("sortListings", () => {
  it("soonest = ascending by start time", () => {
    expect(sortListings([a, b, c], "soonest").map((l) => l.id)).toEqual(["b", "a", "c"]);
  });

  it("latest = descending by start time", () => {
    expect(sortListings([a, b, c], "latest").map((l) => l.id)).toEqual(["c", "a", "b"]);
  });

  it("listings without a start time sort last in both directions", () => {
    expect(sortListings([noDate, a, b], "soonest").map((l) => l.id)).toEqual(["b", "a", "nodate"]);
    expect(sortListings([noDate, a, b], "latest").map((l) => l.id)).toEqual(["a", "b", "nodate"]);
  });

  it("does not mutate the input array", () => {
    const input = [a, b, c];
    sortListings(input, "latest");
    expect(input.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });
});
