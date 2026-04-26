import { describe, expect, it } from "vitest";
import { eventKey, makeSlug } from "../dedup";

describe("eventKey", () => {
  it("produces the same hash for the same canonical title + venue + day", () => {
    const a = eventKey({
      canonicalTitle: "indie night at mission ballroom",
      venueId: "v1",
      dateStart: "2027-04-11T02:00:00Z",
    });
    const b = eventKey({
      canonicalTitle: "indie night at mission ballroom",
      venueId: "v1",
      dateStart: "2027-04-11T20:00:00Z",
    });
    expect(a).toBe(b);
  });

  it("differs when the day differs", () => {
    const a = eventKey({
      canonicalTitle: "indie night",
      venueId: "v1",
      dateStart: "2027-04-11T02:00:00Z",
    });
    const b = eventKey({
      canonicalTitle: "indie night",
      venueId: "v1",
      dateStart: "2027-04-12T02:00:00Z",
    });
    expect(a).not.toBe(b);
  });

  it("differs when the venue differs", () => {
    const a = eventKey({
      canonicalTitle: "indie night",
      venueId: "v1",
      dateStart: "2027-04-11T02:00:00Z",
    });
    const b = eventKey({
      canonicalTitle: "indie night",
      venueId: "v2",
      dateStart: "2027-04-11T02:00:00Z",
    });
    expect(a).not.toBe(b);
  });

  it("handles null venue and null date", () => {
    const a = eventKey({ canonicalTitle: "x", venueId: null, dateStart: null });
    const b = eventKey({ canonicalTitle: "x", venueId: null, dateStart: null });
    expect(a).toBe(b);
  });
});

describe("makeSlug", () => {
  it("kebab-cases titles", () => {
    expect(makeSlug("Indie Night at The Mission Ballroom!", "ig:abc")).toMatch(
      /^indie-night-at-the-mission-ballroom-[a-f0-9]{6}$/,
    );
  });

  it("falls back to 'listing' when title strips to empty", () => {
    expect(makeSlug("!!!", "ig:xyz")).toMatch(/^listing-[a-f0-9]{6}$/);
  });

  it("is stable across calls with the same source id", () => {
    expect(makeSlug("X", "src1")).toBe(makeSlug("X", "src1"));
  });
});
