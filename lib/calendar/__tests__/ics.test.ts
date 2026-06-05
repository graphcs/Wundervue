import { describe, expect, it } from "vitest";
import { buildIcsFeed, toIcsDate } from "@/lib/calendar/ics";

describe("toIcsDate", () => {
  it("formats ISO to UTC basic form", () => {
    expect(toIcsDate("2026-06-15T22:30:00Z")).toBe("20260615T223000Z");
  });
  it("returns null for unparseable input", () => {
    expect(toIcsDate("nope")).toBeNull();
  });
});

describe("buildIcsFeed", () => {
  const feed = buildIcsFeed(
    [
      {
        id: "abc",
        title: "Jazz, Wine & You",
        startAt: "2026-06-15T22:30:00Z",
        endAt: "2026-06-16T00:00:00Z",
        description: "A night out",
        location: "1226 15th St, Denver",
        url: "https://wundervue.com/events/jazz",
      },
      { id: "no-date", title: "Skip me", startAt: "not-a-date" },
    ],
    { calName: "Wundervue — Saved Events", dtstamp: "20260101T000000Z" },
  );

  it("wraps events in a VCALENDAR with CRLF line breaks", () => {
    expect(feed.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(feed.trim().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("emits a VEVENT with escaped fields and start/end", () => {
    expect(feed).toContain("UID:abc@wundervue");
    expect(feed).toContain("DTSTART:20260615T223000Z");
    expect(feed).toContain("DTEND:20260616T000000Z");
    expect(feed).toContain("SUMMARY:Jazz\\, Wine & You");
    expect(feed).toContain("LOCATION:1226 15th St\\, Denver");
  });

  it("skips events without a usable start date", () => {
    expect(feed).not.toContain("Skip me");
    expect(feed.match(/BEGIN:VEVENT/g)?.length).toBe(1);
  });
});
