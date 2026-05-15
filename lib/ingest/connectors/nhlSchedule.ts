import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// NHL.com's team schedule pages (e.g. /avalanche/schedule) render a JS-only
// SPA with no SSR data inlined. Their public API at api-web.nhle.com is
// stable, unauthenticated, and returns clean game objects — much better
// than scraping the rendered DOM. The "/club-schedule-season/{tricode}/now"
// endpoint returns the current season's full schedule (preseason + reg +
// playoffs as they're confirmed).

const API = "https://api-web.nhle.com/v1/club-schedule-season";

interface NhlTeam {
  id?: number;
  abbrev?: string;
  commonName?: { default?: string };
  placeName?: { default?: string };
}

interface NhlVenue {
  default?: string;
}

interface NhlGame {
  id: number;
  gameDate?: string;
  startTimeUTC?: string;
  // FINAL = completed regulation; OFF = game over with overtime/SO settled;
  // FUT = scheduled but not yet started; PRE/LIVE/CRIT = in-progress states.
  gameState?: string;
  venue?: NhlVenue;
  awayTeam?: NhlTeam;
  homeTeam?: NhlTeam;
  tvBroadcasts?: Array<{ network?: string }>;
}

interface NhlScheduleResponse {
  games?: NhlGame[];
}

function teamLabel(t: NhlTeam | undefined): string {
  if (!t) return "";
  const place = t.placeName?.default;
  const name = t.commonName?.default;
  return [place, name].filter(Boolean).join(" ") || t.abbrev || "";
}

function gameToText(g: NhlGame): string {
  const home = teamLabel(g.homeTeam);
  const away = teamLabel(g.awayTeam);
  // Frame from the home side ("Avalanche vs. Bruins") since we're only
  // surfacing home games on /explore.
  const title = home && away ? `${home} vs. ${away}` : home || away;
  const parts = [`Title: ${title}`];
  if (g.venue?.default) parts.push(`Venue: ${g.venue.default}`);
  if (g.startTimeUTC) parts.push(`When: ${g.startTimeUTC}`);
  const networks = (g.tvBroadcasts ?? [])
    .map((b) => b.network)
    .filter(Boolean)
    .join(", ");
  if (networks) parts.push(`Broadcast: ${networks}`);
  return parts.join("\n");
}

export async function fetchNhlSchedule(source: SourceConfig): Promise<RawItem[]> {
  const tricode = source.nhlTeamTricode;
  if (!tricode) {
    throw new Error(`source ${source.id} missing nhlTeamTricode`);
  }

  const url = `${API}/${tricode}/now`;
  const json = await withRetry(async () => {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`nhl api ${res.status} for ${tricode}`);
    return (await res.json()) as NhlScheduleResponse;
  });

  const now = Date.now();
  const upcoming = (json.games ?? [])
    .filter((g) => g.homeTeam?.abbrev === tricode)
    // FINAL / OFF are completed games. Anything else with a future start
    // time is fair game (FUT/PRE/LIVE/CRIT).
    .filter((g) => g.gameState !== "FINAL" && g.gameState !== "OFF")
    .filter((g) => g.startTimeUTC && new Date(g.startTimeUTC).getTime() > now)
    .sort(
      (a, b) => new Date(a.startTimeUTC!).getTime() - new Date(b.startTimeUTC!).getTime(),
    );

  const limit = source.maxItems;
  const sliced = limit !== undefined ? upcoming.slice(0, limit) : upcoming;
  const fetchedAt = new Date().toISOString();

  return sliced.map((g): RawItem => ({
    sourceId: `${source.id}:${g.id}`,
    sourceUrl: source.url,
    text: gameToText(g),
    fetchedAt,
    venueName: g.venue?.default,
  }));
}
