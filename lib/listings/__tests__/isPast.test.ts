import { describe, expect, it } from "vitest";
import { isPastListing, isPastSpecificDateCard } from "../isPast";

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

describe("isPastSpecificDateCard", () => {
  // Mid-day Denver on 2026-07-16 (start of Denver day = 2026-07-16).
  const nowMs = new Date("2026-07-16T18:00:00Z").getTime();

  it("hides a specific-date card whose day is past (the reported bug)", () => {
    // A recurring deal that kept a stale per-occurrence date_display + a rolling
    // future date_end — date_end is irrelevant here, only the displayed day matters.
    expect(
      isPastSpecificDateCard({ dateDisplay: "Thu, Jul 2", startAt: "2026-07-02T00:00:00+00:00" }, nowMs),
    ).toBe(true);
  });

  it("keeps a recurring-cadence card regardless of a stale date_start", () => {
    expect(
      isPastSpecificDateCard({ dateDisplay: "Every Thursday", startAt: "2026-06-25T00:00:00+00:00" }, nowMs),
    ).toBe(false);
    expect(
      isPastSpecificDateCard({ dateDisplay: "Weekends at 10:00 AM", startAt: "2026-07-04T00:00:00+00:00" }, nowMs),
    ).toBe(false);
    expect(
      isPastSpecificDateCard({ dateDisplay: "Sundays, 9am–1pm through Oct 25", startAt: "2026-05-17T09:00:00+00:00" }, nowMs),
    ).toBe(false);
  });

  it("keeps an ongoing range card even when its start day is past", () => {
    // An exhibition that runs May 14 → Sep 7: past start, but still running.
    expect(
      isPastSpecificDateCard({ dateDisplay: "May 14 - Sep 7", startAt: "2026-05-14T00:00:00+00:00" }, nowMs),
    ).toBe(false);
    expect(
      isPastSpecificDateCard({ dateDisplay: "Through Sept. 7", startAt: "2026-05-14T00:00:00+00:00" }, nowMs),
    ).toBe(false);
  });

  it("keeps a future specific-date card", () => {
    expect(
      isPastSpecificDateCard({ dateDisplay: "Thu, Jul 30", startAt: "2026-07-30T18:00:00+00:00" }, nowMs),
    ).toBe(false);
  });

  it("keeps a specific-date card happening today", () => {
    expect(
      isPastSpecificDateCard({ dateDisplay: "Thu, Jul 16", startAt: "2026-07-16T18:00:00+00:00" }, nowMs),
    ).toBe(false);
  });

  it("treats undated / unparseable cards as not past", () => {
    expect(isPastSpecificDateCard({ dateDisplay: "Thu, Jul 2", startAt: "" }, nowMs)).toBe(false);
    expect(isPastSpecificDateCard({ dateDisplay: "Thu, Jul 2", startAt: "<UNKNOWN>" }, nowMs)).toBe(false);
  });
});
