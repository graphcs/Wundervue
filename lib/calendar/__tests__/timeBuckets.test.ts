import { describe, expect, it } from "vitest";
import { timeBucketOf, groupByTimeBucket } from "@/lib/calendar/timeBuckets";

const at = (timeDisplay: string) => ({ timeDisplay });

describe("timeBucketOf", () => {
  // Bucketing reads the wall-clock hour from time_display (the string users see),
  // which is correct regardless of date_start's timezone convention.
  it("buckets by the time_display start hour", () => {
    expect(timeBucketOf(at("9:30 AM"))).toBe("morning");
    expect(timeBucketOf(at("12:00 PM"))).toBe("afternoon");
    expect(timeBucketOf(at("4:59 PM"))).toBe("afternoon");
    expect(timeBucketOf(at("5:00 PM"))).toBe("evening");
    expect(timeBucketOf(at("9:15 PM"))).toBe("evening");
    // Ranges and trailing prose still bucket on the first time.
    expect(timeBucketOf(at("9:00 AM - 1:00 PM"))).toBe("morning");
    expect(timeBucketOf(at("Golden hour (approx. 8:30 PM)"))).toBe("evening");
  });

  it("treats missing / non-clock times as all-day", () => {
    expect(timeBucketOf(at("All day"))).toBe("allday");
    expect(timeBucketOf(at("Times vary"))).toBe("allday");
    expect(timeBucketOf(at(""))).toBe("allday");
    // A null time_display can slip through at runtime despite the string type.
    expect(timeBucketOf({ timeDisplay: null as unknown as string })).toBe("allday");
  });
});

describe("groupByTimeBucket", () => {
  it("groups while preserving input order within a bucket", () => {
    const a = at("10:00 AM");
    const b = at("11:00 AM");
    const c = at("7:00 PM");
    const groups = groupByTimeBucket([a, c, b]);
    expect(groups.morning).toEqual([a, b]);
    expect(groups.evening).toEqual([c]);
    expect(groups.afternoon).toEqual([]);
    expect(groups.allday).toEqual([]);
  });
});
