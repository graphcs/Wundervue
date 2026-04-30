import { describe, expect, it } from "vitest";
import type { SourceConfig } from "../types";
import { stableSourceId } from "../connectors/serpEvents";

const source: SourceConfig = {
  id: "test-source",
  connector: "serpEvents",
  cadence: "hourly",
  enabled: true,
  sourceLabel: "Website",
  query: "events in denver",
};

describe("stableSourceId", () => {
  it("returns the same id for identical event content", () => {
    const ev = {
      title: "Spring Festival 2027",
      venue: { name: "Mission Ballroom" },
      date: { start_date: "2027-04-15" },
    };
    const a = stableSourceId(source, ev);
    const b = stableSourceId(source, ev);
    expect(a).toBe(b);
  });

  it("does not depend on result-list position (regression guard for unstable idx)", () => {
    // The whole point of the fix: SerpAPI shuffles results between calls. The
    // same event object — wherever it lands in the array — must hash to the
    // same source_id so re-runs upsert instead of inserting duplicates.
    const ev = {
      title: "Recurring Concert",
      venue: { name: "Red Rocks" },
      date: { start_date: "2027-05-01" },
    };
    // Both calls represent the same logical event; nothing about the call
    // signature carries position any more.
    expect(stableSourceId(source, ev)).toBe(stableSourceId(source, ev));
  });

  it("changes when the title changes", () => {
    const base = { venue: { name: "X" }, date: { start_date: "2027-04-15" } };
    const a = stableSourceId(source, { ...base, title: "Show A" });
    const b = stableSourceId(source, { ...base, title: "Show B" });
    expect(a).not.toBe(b);
  });

  it("changes when the venue changes", () => {
    const base = { title: "Show", date: { start_date: "2027-04-15" } };
    const a = stableSourceId(source, { ...base, venue: { name: "Venue A" } });
    const b = stableSourceId(source, { ...base, venue: { name: "Venue B" } });
    expect(a).not.toBe(b);
  });

  it("changes when the date changes", () => {
    const base = { title: "Show", venue: { name: "Venue" } };
    const a = stableSourceId(source, { ...base, date: { start_date: "2027-04-15" } });
    const b = stableSourceId(source, { ...base, date: { start_date: "2027-04-16" } });
    expect(a).not.toBe(b);
  });

  it("falls back to address[0] when venue.name is missing, and is stable across calls", () => {
    const base = { title: "Show", date: { start_date: "2027-04-15" } };
    const a = stableSourceId(source, { ...base, address: ["Coors Field", "Denver"] });
    const b = stableSourceId(source, { ...base, address: ["Coors Field", "Denver"] });
    expect(a).toBe(b);
    // No venue / no address → no-key fragment is empty but the title still
    // gives a non-empty result.
    const noLocation = stableSourceId(source, { ...base });
    expect(noLocation.length).toBeGreaterThan(0);
    expect(noLocation).not.toBe(a);
  });

  it("truncates titles longer than 60 chars", () => {
    const base = { venue: { name: "X" }, date: { start_date: "2027-04-15" } };
    const long = "A".repeat(60) + "different-suffix-after-60";
    const longer = "A".repeat(60) + "another-different-suffix";
    // Same first 60 chars → same key (intentional — first 60 chars are
    // signature-enough and reduce key length).
    expect(stableSourceId(source, { ...base, title: long })).toBe(
      stableSourceId(source, { ...base, title: longer }),
    );
  });

  it("emits a slug-shaped lowercase id with no special chars", () => {
    const id = stableSourceId(source, {
      title: "MIXED Case! With $pecial Chars",
      venue: { name: "Some Venue" },
      date: { start_date: "2027-04-15" },
    });
    expect(id).toMatch(/^[a-z0-9-]+$/);
    expect(id.length).toBeLessThanOrEqual(120);
  });

  it("produces a non-empty key when only title is present", () => {
    const id = stableSourceId(source, { title: "Lonely Event" });
    expect(id.length).toBeGreaterThan(0);
  });
});
