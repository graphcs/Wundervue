import { describe, expect, it } from "vitest";
import { timeBucketOf, groupByTimeBucket } from "@/lib/calendar/timeBuckets";

const at = (iso: string) => ({ startAt: iso });

describe("timeBucketOf", () => {
  it("buckets by local start hour", () => {
    expect(timeBucketOf(at("2026-06-10T09:30:00"))).toBe("morning");
    expect(timeBucketOf(at("2026-06-10T12:00:00"))).toBe("afternoon");
    expect(timeBucketOf(at("2026-06-10T16:59:00"))).toBe("afternoon");
    expect(timeBucketOf(at("2026-06-10T17:00:00"))).toBe("evening");
    expect(timeBucketOf(at("2026-06-10T21:15:00"))).toBe("evening");
  });

  it("treats midnight / missing / unparseable times as all-day", () => {
    expect(timeBucketOf(at("2026-06-10T00:00:00"))).toBe("allday");
    expect(timeBucketOf({ startAt: "" })).toBe("allday");
    expect(timeBucketOf({ startAt: "not-a-date" })).toBe("allday");
  });
});

describe("groupByTimeBucket", () => {
  it("groups while preserving input order within a bucket", () => {
    const a = at("2026-06-10T10:00:00");
    const b = at("2026-06-10T11:00:00");
    const c = at("2026-06-10T19:00:00");
    const groups = groupByTimeBucket([a, c, b]);
    expect(groups.morning).toEqual([a, b]);
    expect(groups.evening).toEqual([c]);
    expect(groups.afternoon).toEqual([]);
    expect(groups.allday).toEqual([]);
  });
});
