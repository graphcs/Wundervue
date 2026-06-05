import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNbaSchedule } from "../connectors/nbaSchedule";
import type { SourceConfig } from "../types";

const NUGGETS = 1610612743;

const source: SourceConfig = {
  id: "denver-nuggets-web",
  enabled: true,
  connector: "nbaSchedule",
  cadence: "weekly",
  sourceLabel: "Website",
  nbaTeamId: NUGGETS,
  nbaTeamSlug: "nuggets",
  defaultVenueSlug: "ball-arena",
};

// One representative game of each shape the filter must handle.
const FEED = {
  gscd: {
    tid: NUGGETS,
    g: [
      {
        // future HOME game at Ball Arena — the one we keep
        gid: "0022500500",
        gdte: "2025-12-15",
        gdtutc: "2025-12-16",
        utctm: "02:00",
        an: "Ball Arena",
        ac: "Denver",
        st: "1",
        stt: "7:00 pm ET",
        v: { tid: 1610612747, tc: "Los Angeles", tn: "Lakers" },
        h: { tid: NUGGETS, tc: "Denver", tn: "Nuggets" },
      },
      {
        // AWAY game — Nuggets are the visitor, drop it
        gid: "0022500501",
        gdte: "2025-12-20",
        gdtutc: "2025-12-21",
        utctm: "03:00",
        an: "Crypto.com Arena",
        ac: "Los Angeles",
        st: "1",
        stt: "8:00 pm ET",
        v: { tid: NUGGETS, tc: "Denver", tn: "Nuggets" },
        h: { tid: 1610612747, tc: "Los Angeles", tn: "Lakers" },
      },
      {
        // neutral-site "home" preseason game in San Diego — drop it
        gid: "0012500028",
        gdte: "2025-12-18",
        gdtutc: "2025-12-19",
        utctm: "03:00",
        an: "Pechanga Arena",
        ac: "San Diego",
        st: "1",
        stt: "9:00 pm ET",
        v: { tid: 1610612750, tc: "Minnesota", tn: "Timberwolves" },
        h: { tid: NUGGETS, tc: "Denver", tn: "Nuggets" },
      },
      {
        // past HOME game (already played) — drop it
        gid: "0022500001",
        gdte: "2025-10-14",
        gdtutc: "2025-10-15",
        utctm: "01:00",
        an: "Ball Arena",
        ac: "Denver",
        st: "3",
        stt: "Final",
        v: { tid: 1610612741, tc: "Chicago", tn: "Bulls" },
        h: { tid: NUGGETS, tc: "Denver", tn: "Nuggets" },
      },
    ],
  },
};

describe("fetchNbaSchedule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mid-season: season year resolves to 2025 and "today" is 2025-12-01.
    vi.setSystemTime(new Date("2025-12-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps only future home games at the team's own arena", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => FEED,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchNbaSchedule(source);

    expect(items).toHaveLength(1);
    const [game] = items;
    expect(game.sourceId).toBe("0022500500");
    expect(game.venueName).toBe("Ball Arena");
    expect(game.sourceUrl).toBe("https://www.nba.com/nuggets/schedule");
    expect(game.text).toContain("Denver Nuggets vs Los Angeles Lakers");
    // venue-local date, not the UTC calendar day (Dec 16 UTC → Dec 15 in Denver)
    expect(game.text).toContain("Dec 15, 2025");
  });

  it("requests the current season's feed with browser headers", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: { headers?: Record<string, string> }) => ({
        ok: true,
        json: async () => FEED,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchNbaSchedule(source);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://data.nba.com/data/v2015/json/mobile_teams/nba/2025/teams/nuggets_schedule.json",
    );
    expect(init?.headers?.Referer).toBe("https://www.nba.com/");
    expect(init?.headers?.["User-Agent"]).toMatch(/Mozilla/);
  });

  it("returns an empty list in the offseason (no future games)", async () => {
    // July, after the season ended and before the next one publishes: season
    // year still resolves to 2025, but every game in the feed is now past.
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => FEED }));
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchNbaSchedule(source);
    expect(items).toEqual([]);
  });

  it("throws when team identifiers are missing", async () => {
    await expect(
      fetchNbaSchedule({ ...source, nbaTeamId: undefined }),
    ).rejects.toThrow(/missing nbaTeamId/);
  });
});
