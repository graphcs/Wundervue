import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNhlSchedule } from "../connectors/nhlSchedule";
import type { SourceConfig } from "../types";

const source: SourceConfig = {
  id: "colorado-avalanche-web",
  enabled: true,
  connector: "nhlSchedule",
  cadence: "weekly",
  sourceLabel: "Website",
  nhlTeamAbbrev: "COL",
  nhlTeamSlug: "avalanche",
  defaultVenueSlug: "ball-arena",
};

const COL = {
  abbrev: "COL",
  placeName: { default: "Colorado" },
  commonName: { default: "Avalanche" },
};
const VGK = {
  abbrev: "VGK",
  placeName: { default: "Vegas" },
  commonName: { default: "Golden Knights" },
};

const FEED = {
  currentSeason: 20252026,
  games: [
    {
      // future HOME game at Ball Arena — the one we keep
      id: 2025020500,
      gameType: 2,
      gameDate: "2025-12-15",
      startTimeUTC: "2025-12-16T02:00:00Z",
      venue: { default: "Ball Arena" },
      gameState: "FUT",
      gameScheduleState: "OK",
      homeTeam: COL,
      awayTeam: VGK,
    },
    {
      // AWAY game — Avalanche are the visitor, drop it
      id: 2025020501,
      gameType: 2,
      gameDate: "2025-12-20",
      startTimeUTC: "2025-12-21T03:00:00Z",
      venue: { default: "T-Mobile Arena" },
      gameState: "FUT",
      gameScheduleState: "OK",
      homeTeam: VGK,
      awayTeam: COL,
    },
    {
      // neutral-site "home" game (Stadium Series) — not at Ball Arena, drop it
      id: 2025020502,
      gameType: 2,
      gameDate: "2025-12-22",
      startTimeUTC: "2025-12-23T01:00:00Z",
      venue: { default: "Empower Field at Mile High" },
      gameState: "FUT",
      gameScheduleState: "OK",
      homeTeam: COL,
      awayTeam: VGK,
    },
    {
      // postponed home game — drop it
      id: 2025020503,
      gameType: 2,
      gameDate: "2025-12-28",
      startTimeUTC: "2025-12-29T02:00:00Z",
      venue: { default: "Ball Arena" },
      gameState: "FUT",
      gameScheduleState: "PPD",
      homeTeam: COL,
      awayTeam: VGK,
    },
    {
      // past HOME game (already played) — drop it
      id: 2025020001,
      gameType: 2,
      gameDate: "2025-10-14",
      startTimeUTC: "2025-10-15T01:00:00Z",
      venue: { default: "Ball Arena" },
      gameState: "FINAL",
      gameScheduleState: "OK",
      homeTeam: COL,
      awayTeam: VGK,
    },
  ],
};

describe("fetchNhlSchedule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps only future home games at Ball Arena", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => FEED }));
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchNhlSchedule(source);

    expect(items).toHaveLength(1);
    const [game] = items;
    expect(game.sourceId).toBe("2025020500");
    expect(game.venueName).toBe("Ball Arena");
    expect(game.sourceUrl).toBe("https://www.nhl.com/avalanche/schedule");
    expect(game.text).toContain("Colorado Avalanche vs Vegas Golden Knights");
    // venue-local date, not the UTC calendar day (Dec 16 UTC → Dec 15 in Denver)
    expect(game.text).toContain("Dec 15, 2025");
  });

  it("hits the season-agnostic /now endpoint", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: { headers?: Record<string, string> }) => ({
        ok: true,
        json: async () => FEED,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchNhlSchedule(source);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-web.nhle.com/v1/club-schedule-season/COL/now");
  });

  it("returns an empty list in the offseason (no future games)", async () => {
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => FEED }));
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchNhlSchedule(source);
    expect(items).toEqual([]);
  });

  it("throws when team identifiers are missing", async () => {
    await expect(
      fetchNhlSchedule({ ...source, nhlTeamAbbrev: undefined }),
    ).rejects.toThrow(/missing nhlTeamAbbrev/);
  });
});
