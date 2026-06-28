import { describe, it, expect } from "vitest";
import { seriesBaseKey, seriesFirstSeen, isFresh } from "../freshness";

describe("seriesBaseKey", () => {
  it("strips the #YYYY-MM-DD occurrence suffix so all dates collapse to one series", () => {
    expect(seriesBaseKey("Website", "por:whiskey#2026-07-01")).toBe("Website:por:whiskey");
    expect(seriesBaseKey("Website", "por:whiskey#2026-07-08")).toBe("Website:por:whiskey");
    expect(seriesBaseKey("Website", "por:one-off")).toBe("Website:por:one-off");
  });
});

describe("seriesFirstSeen", () => {
  it("uses the EARLIEST created_at across a series' occurrences (not a freshly-added date)", () => {
    const rows = [
      { source: "Website", source_id: "s#2026-07-01", created_at: "2026-06-01T00:00:00Z" },
      { source: "Website", source_id: "s#2026-07-08", created_at: "2026-06-20T00:00:00Z" }, // window rolled
      { source: "Website", source_id: "one-off", created_at: "2026-06-25T00:00:00Z" },
    ];
    const m = seriesFirstSeen(rows);
    expect(m.get("Website:s")).toBe("2026-06-01T00:00:00Z");
    expect(m.get("Website:one-off")).toBe("2026-06-25T00:00:00Z");
  });

  it("skips rows missing source_id or created_at", () => {
    const m = seriesFirstSeen([
      { source: "X", source_id: null, created_at: "2026-06-01T00:00:00Z" },
      { source: "X", source_id: "y", created_at: null },
    ]);
    expect(m.size).toBe(0);
  });
});

describe("isFresh", () => {
  const now = Date.parse("2026-06-26T12:00:00Z");
  it("is true inside the 7-day window and false outside / when missing", () => {
    expect(isFresh("2026-06-24T00:00:00Z", now)).toBe(true);
    expect(isFresh("2026-06-01T00:00:00Z", now)).toBe(false); // 25 days old
    expect(isFresh(undefined, now)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
  });
});
