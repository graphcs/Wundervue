import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDenverSummitFcSchedule } from "../connectors/denverSummitFcSchedule";
import type { SourceConfig } from "../types";

const source: SourceConfig = {
  id: "denver-summit-fc-web",
  enabled: true,
  connector: "denverSummitFcSchedule",
  cadence: "weekly",
  sourceLabel: "Website",
  url: "https://www.denversummitfc.com/schedule/",
  defaultVenueSlug: "dick-s-sporting-goods-park",
};

function match(opts: { home: boolean; date: string; time?: string; opp: string; ticket?: string }): string {
  return `<div class="schedule__match">
    <div class="schedule__match-indicator-label">${opts.home ? "Home" : "Away"}</div>
    <div class="schedule__match-day">Friday</div>
    <div class="schedule__match-date">${opts.date}</div>
    <div class="schedule__match-time">${opts.time ?? ""}</div>
    <a href="${opts.ticket ?? "#"}" class="schedule__cta">Buy Tickets</a>
    <span class="schedule__match-opponent-name">${opts.opp}</span>
    <div class="schedule__match-value">DICK&rsquo;S Sporting Goods Park</div>
  </div>`;
}

const HTML = `<html><body>
  ${match({ home: true, date: "Jul 3", time: "7:30PM MDT", opp: "Kansas City Current", ticket: "https://www.ticketmaster.com/event/ABC" })}
  ${match({ home: false, date: "Jul 12", time: "5:00PM MDT", opp: "Houston Dash" })}
  ${match({ home: true, date: "Mar 5", opp: "Portland Thorns" })}
  ${match({ home: true, date: "Jun 1", opp: "Past Opponent" })}
  ${match({ home: true, date: "Jul 3", time: "7:30PM MDT", opp: "Kansas City Current" })}
</body></html>`;

describe("fetchDenverSummitFcSchedule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T18:00:00Z"));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => HTML })));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps home games only, drops away/past, dedupes, sorts soonest-first", async () => {
    const items = await fetchDenverSummitFcSchedule(source);
    const titles = items.map((i) => i.text.split("\n")[0]);
    expect(titles).toEqual([
      "Denver Summit FC vs Kansas City Current", // Jul 3, 2026
      "Denver Summit FC vs Portland Thorns", // Mar 5 → next year
    ]);
    expect(titles.some((t) => t.includes("Houston Dash"))).toBe(false); // away
    expect(titles.some((t) => t.includes("Past Opponent"))).toBe(false); // already played
  });

  it("parses date/time, infers year, pins the venue", async () => {
    const items = await fetchDenverSummitFcSchedule(source);
    const kc = items[0];
    expect(kc.text).toContain("Date: July 3, 2026");
    expect(kc.text).toContain("Time: 7:30PM MDT");
    expect(kc.text).toContain("Category: Sports");
    expect(kc.text).toContain("Venue: DICK'S Sporting Goods Park, 6000 Victory Way");
    expect(kc.venueName).toBe("DICK'S Sporting Goods Park");
    expect(kc.sourceUrl).toBe("https://www.ticketmaster.com/event/ABC");
    // Mar 5 rolls to the next year (month already behind us in June).
    expect(items[1].text).toContain("Date: March 5, 2027");
  });

  it("respects maxItems", async () => {
    const items = await fetchDenverSummitFcSchedule({ ...source, maxItems: 1 });
    expect(items).toHaveLength(1);
    expect(items[0].text.split("\n")[0]).toBe("Denver Summit FC vs Kansas City Current");
  });

  it("throws when url is missing", async () => {
    await expect(fetchDenverSummitFcSchedule({ ...source, url: undefined })).rejects.toThrow(/missing url/);
  });
});
