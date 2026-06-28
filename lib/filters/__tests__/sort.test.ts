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

  // Default browse = "soonest, but new first". Fixed `now` so the clamp is stable.
  const NOW = Date.parse("2026-06-28T12:00:00Z");

  it("soonest: within a day, newly-scraped (isNew) events lead, then by start time", () => {
    const oldEarly = mk("oldEarly", "2026-07-04T18:00:00Z", { isNew: false });
    const freshLate = mk("freshLate", "2026-07-04T22:00:00Z", { isNew: true });
    const oldLate = mk("oldLate", "2026-07-04T23:00:00Z", { isNew: false });
    expect(sortListings([oldEarly, freshLate, oldLate], "soonest", NOW).map((l) => l.id)).toEqual([
      "freshLate",
      "oldEarly",
      "oldLate",
    ]);
  });

  it("soonest: a recurring 'Every Thursday' deal sorts to its next Thursday, not to today", () => {
    // NOW is Sunday Jun 28; the next Thursday is Jul 2, so a same-day event leads.
    const sundayEvt = mk("sun", "2026-06-28T20:00:00Z");
    const thuDeal = mk("thuDeal", "2026-06-28T18:00:00Z", {
      type: "deal", dateDisplay: "Every Thursday", isNew: true,
    });
    expect(sortListings([thuDeal, sundayEvt], "soonest", NOW).map((l) => l.id)).toEqual([
      "sun",
      "thuDeal",
    ]);
  });

  it("soonest: an ongoing past-start run sorts as today, not above genuinely-future events", () => {
    const ongoing = mk("ongoing", "2026-05-01T18:00:00Z"); // started long ago, still listed
    const today = mk("today", "2026-06-28T20:00:00Z");
    const future = mk("future", "2026-07-10T18:00:00Z");
    const ids = sortListings([future, ongoing, today], "soonest", NOW).map((l) => l.id);
    expect(ids[2]).toBe("future"); // future is genuinely later → last
    expect(ids.slice(0, 2).sort()).toEqual(["ongoing", "today"]); // both clamp to today
  });
});
