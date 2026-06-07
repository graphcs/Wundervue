import { describe, expect, it } from "vitest";
import { sortListings } from "../applyFilters";
import type { Listing } from "@/lib/types";

function mk(id: string, startAt: string, extra: Partial<Listing> = {}): Listing {
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
    ...extra,
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

  it("free-first = free listings before paid, soonest within each group", () => {
    const paidEarly = mk("paidEarly", "2026-06-05T00:00:00Z");
    const freeLate = mk("freeLate", "2026-06-20T00:00:00Z", { isFree: true });
    const freeEarly = mk("freeEarly", "2026-06-10T00:00:00Z", { isFree: true });
    expect(sortListings([paidEarly, freeLate, freeEarly], "free-first").map((l) => l.id)).toEqual([
      "freeEarly",
      "freeLate",
      "paidEarly",
    ]);
  });

  it("deals-first = deal-type listings first; events with a deal_value are not deals", () => {
    const eventEarly = mk("eventEarly", "2026-06-05T00:00:00Z", { type: "event", dealValue: "Perks!" });
    const dealLate = mk("dealLate", "2026-06-20T00:00:00Z", { type: "deal" });
    const bothMid = mk("bothMid", "2026-06-10T00:00:00Z", { type: "both" });
    // deal + both rank first (soonest tiebreak: bothMid before dealLate); the
    // event sorts last despite carrying a dealValue.
    expect(sortListings([eventEarly, dealLate, bothMid], "deals-first").map((l) => l.id)).toEqual([
      "bothMid",
      "dealLate",
      "eventEarly",
    ]);
  });

  it("most-saved = higher saveCount first, soonest tiebreak", () => {
    const lowLate = mk("lowLate", "2026-06-20T00:00:00Z", { saveCount: 2 });
    const highA = mk("highA", "2026-06-10T00:00:00Z", { saveCount: 50 });
    const highB = mk("highB", "2026-06-05T00:00:00Z", { saveCount: 50 });
    expect(sortListings([lowLate, highA, highB], "most-saved").map((l) => l.id)).toEqual([
      "highB",
      "highA",
      "lowLate",
    ]);
  });
});
