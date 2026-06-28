import { describe, expect, it } from "vitest";
import { expandRecurringOccurrences, parseWeekdays } from "../expandOccurrences";
import type { ListingInsert, NormalizedListing } from "../types";

const NOW = Date.parse("2026-06-24T12:00:00Z"); // Wednesday

function row(over: Partial<ListingInsert>): ListingInsert {
  return {
    slug: "s", type: "event", title: "Highlands Farmers Market", description: "d",
    venue_id: "v1", address: null, neighborhood: null, region_slug: null, city_slug: null,
    neighborhood_slug: null, category: "Markets", date_start: null, date_end: null,
    date_display: null, time_display: null, is_free: true, deal_value: null,
    image_url: "https://img/market.jpg", image_source: "generated", source: "Website",
    source_url: null, source_id: "boulder:1", event_key: "k0", dedup_of: null, tags: [],
    lat: null, lng: null, published_at: "2026-06-24T00:00:00Z",
    ...over,
  };
}

function norm(over: Partial<NormalizedListing>): NormalizedListing {
  return {
    isEventOrDeal: true, type: "event", title: "Highlands Farmers Market",
    canonicalTitle: "highlands farmers market", description: "d", category: "Markets",
    neighborhood: "", dateStart: null, dateEnd: null, dateDisplay: "", timeDisplay: "",
    isFree: true, dealValue: null, recurring: false, tags: [], venueName: null, address: null,
    ...over,
  };
}

describe("parseWeekdays", () => {
  it("reads a single weekday", () => {
    expect([...parseWeekdays("Every Sunday")]).toEqual([0]);
    expect([...parseWeekdays("Saturdays")]).toEqual([6]);
  });
  it("reads multiple weekdays incl. abbreviations", () => {
    expect([...parseWeekdays("Tue & Thu")].sort()).toEqual([2, 4]);
    expect([...parseWeekdays("Mondays and Wednesdays")].sort()).toEqual([1, 3]);
  });
  it("returns empty when no weekday named", () => {
    expect(parseWeekdays("Open daily").size).toBe(0);
    expect(parseWeekdays("").size).toBe(0);
  });
});

describe("expandRecurringOccurrences", () => {
  // Every Sunday, 9 AM–1 PM. date_start is the first Sunday at 9 AM MDT (15:00 UTC).
  const sundayMarket = () => {
    const base = row({
      date_start: "2026-06-28T15:00:00Z",
      date_display: "Every Sunday",
      time_display: "9:00 AM – 1:00 PM",
    });
    const map = new Map([[base.source_id, norm({ recurring: true, dateDisplay: "Every Sunday" })]]);
    return { base, map };
  };

  it("splits a weekly event into capped, dated occurrences", () => {
    const { base, map } = sundayMarket();
    const out = expandRecurringOccurrences([base], map, NOW);

    expect(out).toHaveLength(8); // MAX_OCCURRENCES
    // Consecutive Sundays, anchored at midday Denver (18:00Z) so the UTC day
    // matches the local day.
    expect(out[0].date_start).toBe("2026-06-28T18:00:00.000Z");
    expect(out[1].date_start).toBe("2026-07-05T18:00:00.000Z");
    // Specific-day display + preserved time label, 4-hour span.
    expect(out[0].date_display).toBe("Sun, Jun 28");
    expect(out[0].time_display).toBe("9:00 AM – 1:00 PM");
    expect(out[0].date_end).toBe("2026-06-28T22:00:00.000Z");
  });

  it("gives each occurrence a stable, distinct id/key but shares the image", () => {
    const { base, map } = sundayMarket();
    const out = expandRecurringOccurrences([base], map, NOW);

    expect(out[0].source_id).toBe("boulder:1#2026-06-28");
    expect(out[1].source_id).toBe("boulder:1#2026-07-05");
    expect(new Set(out.map((o) => o.event_key)).size).toBe(out.length); // all distinct
    expect(new Set(out.map((o) => o.source_id)).size).toBe(out.length);
    expect(out.every((o) => o.image_url === "https://img/market.jpg")).toBe(true);
  });

  it("caps to a real series end inside the window", () => {
    const { base } = sundayMarket();
    const map = new Map([
      [base.source_id, norm({ recurring: true, dateDisplay: "Every Sunday", dateEnd: "2026-07-12T13:00:00Z" })],
    ]);
    const out = expandRecurringOccurrences([base], map, NOW);
    // Only Jun 28, Jul 5, Jul 12 fall on/before the series end.
    expect(out.map((o) => o.date_display)).toEqual(["Sun, Jun 28", "Sun, Jul 5", "Sun, Jul 12"]);
  });

  it("handles multiple weekdays", () => {
    // Jun 30 2026 is a Tuesday.
    const base = row({
      source_id: "x:1", date_start: "2026-06-30T18:00:00Z",
      date_display: "Tuesdays & Thursdays", time_display: "6:00 PM",
    });
    const map = new Map([[base.source_id, norm({ recurring: true, dateDisplay: "Tue & Thu" })]]);
    const out = expandRecurringOccurrences([base], map, NOW);
    const labels = out.map((o) => o.date_display ?? "");
    expect(labels.some((l) => l.startsWith("Tue"))).toBe(true);
    expect(labels.some((l) => l.startsWith("Thu"))).toBe(true);
  });

  it("passes through non-recurring and weekday-less (perpetual) rows", () => {
    const oneOff = row({ source_id: "a", date_start: "2026-07-04T18:00:00Z", date_display: "Sat, Jul 4" });
    const daily = row({ source_id: "c", date_display: "Open daily" });
    const map = new Map<string, NormalizedListing>([
      [oneOff.source_id, norm({ recurring: false })],
      // Perpetual deal with no specific weekday → keeps its rolling window.
      [daily.source_id, norm({ recurring: true, type: "deal", dateDisplay: "Open daily" })],
    ]);
    const out = expandRecurringOccurrences([oneOff, daily], map, NOW);
    expect(out).toEqual([oneOff, daily]); // untouched
  });

  it("splits a weekly listing the LLM marked non-recurring (text says 'every Thursday')", () => {
    const base = row({
      source_id: "p", date_start: "2026-07-02T18:00:00Z", date_display: "Thu, Jul 2",
      time_display: "8:00 PM – 11:00 PM",
    });
    const map = new Map([[base.source_id, norm({
      recurring: false, title: "Thursday Poker Night",
      description: "Join us each Thursday evening for complimentary poker.",
      dateDisplay: "Thu, Jul 2",
    })]]);
    const out = expandRecurringOccurrences([base], map, NOW);
    expect(out.length).toBeGreaterThan(1);
    expect(out.every((o) => (o.date_display ?? "").startsWith("Thu"))).toBe(true);
  });

  it("does NOT re-split a connector's pre-expanded instance (connectorRecurring=false)", () => {
    // tribeEvents/localist emit specific dated occurrences; a description saying
    // "every Monday" must not re-trigger splitting (would invent duplicate dates).
    const base = row({
      source_id: "i", date_start: "2026-06-29T16:00:00Z", date_display: "Mon, Jun 29",
      description: "A weekly tour offered every Monday.",
    });
    const map = new Map([[base.source_id, norm({
      recurring: false, connectorRecurring: false,
      description: "A weekly tour offered every Monday.", dateDisplay: "Mon, Jun 29",
    })]]);
    const out = expandRecurringOccurrences([base], map, NOW);
    expect(out).toEqual([base]); // untouched
  });

  it("does NOT split a recurring DEAL with a weekday — it keeps its rolling window", () => {
    // A weekly happy hour / ladies night is an ongoing offer, not a per-week event.
    const base = row({
      source_id: "d", type: "deal", date_start: "2026-06-29T15:00:00Z",
      date_display: "Mondays", time_display: "3:00 PM – 10:00 PM",
    });
    const map = new Map([[base.source_id, norm({ recurring: true, type: "deal", dateDisplay: "Mondays" })]]);
    const out = expandRecurringOccurrences([base], map, NOW);
    expect(out).toEqual([base]); // untouched
  });

  it("splits a continuous multi-day run into one card per day from today (capped)", () => {
    const base = row({
      source_id: "fest", date_start: "2026-05-25T18:00:00Z", date_end: "2026-09-07T18:00:00Z",
      date_display: "May 25 – Sep 7", time_display: "10:00 AM – 4:00 PM",
    });
    const map = new Map([[base.source_id, norm({
      recurring: false, dateEnd: "2026-09-07T18:00:00Z", dateDisplay: "May 25 – Sep 7",
    })]]);
    const out = expandRecurringOccurrences([base], map, NOW); // NOW = Wed 2026-06-24
    expect(out.length).toBe(8); // MAX_OCCURRENCES
    const days = out.map((o) => o.date_start!.slice(0, 10));
    expect(new Set(days).size).toBe(8); // distinct consecutive days
    expect(days.every((d) => d >= "2026-06-24")).toBe(true); // none before today
  });

  it("a multi-day range that names a weekday splits WEEKLY on that day, not daily", () => {
    const base = row({
      source_id: "yoga", date_start: "2026-07-11T18:00:00Z", date_end: "2026-08-29T18:00:00Z",
      date_display: "Jul 11 – Aug 29", time_display: "7:00 AM",
    });
    const map = new Map([[base.source_id, norm({
      recurring: false, title: "Yoga on the Rocks",
      description: "Start your Saturday morning in nature.", dateEnd: "2026-08-29T18:00:00Z",
    })]]);
    const out = expandRecurringOccurrences([base], map, NOW);
    expect(out.length).toBeGreaterThan(1);
    expect(out.every((o) => (o.date_display ?? "").startsWith("Sat"))).toBe(true);
  });

  it("splits a short multi-day run only through its end day", () => {
    const base = row({
      source_id: "wknd", date_start: "2026-06-26T18:00:00Z", date_end: "2026-06-28T18:00:00Z",
      date_display: "Jun 26 – 28",
    });
    const map = new Map([[base.source_id, norm({ recurring: false, dateEnd: "2026-06-28T18:00:00Z" })]]);
    const out = expandRecurringOccurrences([base], map, NOW);
    expect(out.length).toBe(3); // Jun 26, 27, 28
    expect(out.every((o) => (o.date_start ?? "") <= "2026-06-28T23:59:59Z")).toBe(true);
  });

  it("does NOT split a single-day event (end same day as start)", () => {
    const base = row({
      source_id: "one", date_start: "2026-07-04T18:00:00Z", date_end: "2026-07-04T22:00:00Z",
      date_display: "Sat, Jul 4",
    });
    const map = new Map([[base.source_id, norm({ recurring: false })]]);
    expect(expandRecurringOccurrences([base], map, NOW)).toEqual([base]);
  });

  it("does NOT daily-split a RECURRING deal (keeps its rolling window)", () => {
    const base = row({
      source_id: "sale", type: "deal", date_start: "2026-06-25T18:00:00Z", date_end: "2026-07-25T18:00:00Z",
    });
    const map = new Map([[base.source_id, norm({ recurring: true, type: "deal", dateEnd: "2026-07-25T18:00:00Z" })]]);
    expect(expandRecurringOccurrences([base], map, NOW)).toEqual([base]);
  });

  it("splits a non-recurring WINDOWED deal into per-day cards (a limited-time treat)", () => {
    const base = row({
      source_id: "treat", type: "deal", date_start: "2026-06-26T18:00:00Z", date_end: "2026-06-30T18:00:00Z",
      date_display: "Jun 6 – Jun 30",
    });
    const map = new Map([[base.source_id, norm({ recurring: false, type: "deal", dateEnd: "2026-06-30T18:00:00Z" })]]);
    const out = expandRecurringOccurrences([base], map, NOW); // NOW = Jun 24
    expect(out.length).toBe(5); // Jun 26, 27, 28, 29, 30
    expect(out.every((o) => o.type === "deal")).toBe(true);
  });
});
