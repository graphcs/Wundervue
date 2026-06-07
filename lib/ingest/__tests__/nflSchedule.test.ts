import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNflSchedule } from "../connectors/nflSchedule";
import type { SourceConfig } from "../types";

const source: SourceConfig = {
  id: "denver-broncos-web",
  enabled: true,
  connector: "nflSchedule",
  cadence: "weekly",
  sourceLabel: "Website",
  nflTeamAbbrev: "DEN",
  url: "https://www.denverbroncos.com/schedule/",
  defaultVenueSlug: "empower-field",
};

const DEN = { abbreviation: "DEN", displayName: "Denver Broncos" };
const KC = { abbreviation: "KC", displayName: "Kansas City Chiefs" };

function event(opts: {
  id: string;
  date: string;
  home: typeof DEN;
  away: typeof DEN;
  venue: string;
  city?: string;
  status?: string;
  completed?: boolean;
}) {
  return {
    id: opts.id,
    date: opts.date,
    competitions: [
      {
        venue: { fullName: opts.venue, address: { city: opts.city } },
        status: {
          type: {
            name: opts.status ?? "STATUS_SCHEDULED",
            completed: opts.completed ?? false,
          },
        },
        competitors: [
          { homeAway: "home", team: opts.home },
          { homeAway: "away", team: opts.away },
        ],
      },
    ],
  };
}

const FEED = {
  events: [
    // future HOME game at Empower Field — the one we keep
    event({
      id: "401872900",
      date: "2026-11-01T21:25Z",
      home: DEN,
      away: KC,
      venue: "Empower Field at Mile High",
      city: "Denver",
    }),
    // AWAY game — Broncos visit KC, drop it
    event({
      id: "401872901",
      date: "2026-11-08T18:00Z",
      home: KC,
      away: DEN,
      venue: "GEHA Field at Arrowhead Stadium",
      city: "Kansas City",
    }),
    // neutral-site international "home" game (London) — not in Denver, drop it
    event({
      id: "401872902",
      date: "2026-10-04T13:30Z",
      home: DEN,
      away: KC,
      venue: "Wembley Stadium",
      city: "London",
    }),
    // past HOME game — drop it
    event({
      id: "401872903",
      date: "2025-09-20T20:05Z",
      home: DEN,
      away: KC,
      venue: "Empower Field at Mile High",
      city: "Denver",
      status: "STATUS_FINAL",
      completed: true,
    }),
  ],
};

describe("fetchNflSchedule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps only future home games at the Denver stadium", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => FEED }));
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchNflSchedule(source);

    expect(items).toHaveLength(1);
    const [game] = items;
    expect(game.sourceId).toBe("401872900");
    expect(game.venueName).toBe("Empower Field at Mile High");
    expect(game.sourceUrl).toBe("https://www.denverbroncos.com/schedule/");
    expect(game.text).toContain("Denver Broncos vs Kansas City Chiefs");
  });

  it("hits the season-agnostic ESPN team endpoint", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: { headers?: Record<string, string> }) => ({
        ok: true,
        json: async () => FEED,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchNflSchedule(source);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/DEN/schedule",
    );
  });

  it("returns an empty list when no home games are upcoming", async () => {
    vi.setSystemTime(new Date("2027-03-01T12:00:00Z"));
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => FEED }));
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchNflSchedule(source);
    expect(items).toEqual([]);
  });

  it("throws when the team abbreviation is missing", async () => {
    await expect(
      fetchNflSchedule({ ...source, nflTeamAbbrev: undefined }),
    ).rejects.toThrow(/missing nflTeamAbbrev/);
  });
});
