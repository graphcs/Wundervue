import { describe, expect, it } from "vitest";
import { isPastListing } from "../isPast";

const now = new Date("2026-06-04T12:00:00");

describe("isPastListing", () => {
  it("treats a listing ending before today as past", () => {
    expect(isPastListing({ startAt: "2026-06-01T20:00:00", endAt: null }, now)).toBe(true);
  });

  it("treats a listing later today as not past (uses start of day)", () => {
    expect(isPastListing({ startAt: "2026-06-04T20:00:00", endAt: null }, now)).toBe(false);
  });

  it("treats a future listing as not past", () => {
    expect(isPastListing({ startAt: "2026-06-10T20:00:00", endAt: null }, now)).toBe(false);
  });

  it("uses end date, not start, when present", () => {
    // started in the past but still running → not past
    expect(isPastListing({ startAt: "2026-06-01T00:00:00", endAt: "2026-06-09T00:00:00" }, now)).toBe(false);
    // ended yesterday → past even though it started long ago
    expect(isPastListing({ startAt: "2026-05-01T00:00:00", endAt: "2026-06-03T23:00:00" }, now)).toBe(true);
  });

  it("treats undated listings (perpetual deals) as never past", () => {
    expect(isPastListing({ startAt: "", endAt: null }, now)).toBe(false);
  });

  it("treats unparseable dates as not past", () => {
    expect(isPastListing({ startAt: "<UNKNOWN>", endAt: null }, now)).toBe(false);
  });
});
