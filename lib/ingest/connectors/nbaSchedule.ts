import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// NBA team schedule pages on nba.com (e.g. /nuggets/schedule) are Next.js
// SSR'd with the full season schedule inlined into a `<script
// id="__NEXT_DATA__">` blob. Parsing that JSON is far more reliable than
// scraping the rendered DOM, and gives us structured game data (date,
// arena, opponent, broadcasters) with no AI inference needed.

interface NbaTeam {
  teamId?: number;
  teamName?: string;
  teamCity?: string;
  teamTricode?: string;
  teamSlug?: string;
}

interface NbaGame {
  gameId: string;
  // gameStatus 3 = Final; we want games before that (1 = scheduled, 2 = live)
  gameStatus?: number;
  gameDateUTC?: string;
  gameTimeUTC?: string;
  gameLabel?: string;
  gameSubLabel?: string;
  arenaName?: string;
  arenaCity?: string;
  arenaState?: string;
  homeTeam?: NbaTeam;
  awayTeam?: NbaTeam;
  broadcasters?: unknown;
}

interface NbaNextData {
  props?: {
    pageProps?: {
      scheduleData?: {
        schedule?: NbaGame[];
      };
    };
  };
}

function extractNextData(html: string): NbaNextData {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("__NEXT_DATA__ not found on nba.com schedule page");
  return JSON.parse(m[1]);
}

function gameToText(g: NbaGame, isHome: boolean): string {
  const home = g.homeTeam;
  const away = g.awayTeam;
  const homeFull = home ? `${home.teamCity ?? ""} ${home.teamName ?? ""}`.trim() : "";
  const awayFull = away ? `${away.teamCity ?? ""} ${away.teamName ?? ""}`.trim() : "";
  // Frame from the Denver side: "Nuggets vs. Lakers" reads more naturally
  // on /explore than "Lakers @ Nuggets" even though the latter is the
  // canonical sports formatting.
  const title = isHome ? `${homeFull} vs. ${awayFull}` : `${awayFull} @ ${homeFull}`;
  const parts = [`Title: ${title}`];
  const venue = [g.arenaName, g.arenaCity].filter(Boolean).join(", ");
  if (venue) parts.push(`Venue: ${venue}`);
  if (g.gameDateUTC) parts.push(`When: ${g.gameDateUTC}`);
  if (g.gameLabel) parts.push(`Description: ${g.gameLabel}${g.gameSubLabel ? ` — ${g.gameSubLabel}` : ""}`);
  return parts.join("\n");
}

export async function fetchNbaSchedule(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url) {
    throw new Error(`source ${source.id} missing url`);
  }
  const tricode = source.nbaHomeTeamTricode;
  if (!tricode) {
    throw new Error(`source ${source.id} missing nbaHomeTeamTricode`);
  }

  const html = await withRetry(async () => {
    const res = await fetch(source.url!, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`nba.com ${res.status} for ${source.url}`);
    return res.text();
  });

  const next = extractNextData(html);
  const games = next.props?.pageProps?.scheduleData?.schedule ?? [];

  const now = Date.now();
  const upcoming = games
    .filter((g) => g.homeTeam?.teamTricode === tricode)
    // gameStatus 3 = Final. Anything else with a future date is fair game.
    .filter((g) => g.gameStatus !== 3)
    .filter((g) => g.gameDateUTC && new Date(g.gameDateUTC).getTime() > now)
    .sort(
      (a, b) => new Date(a.gameDateUTC!).getTime() - new Date(b.gameDateUTC!).getTime(),
    );

  const limit = source.maxItems;
  const sliced = limit !== undefined ? upcoming.slice(0, limit) : upcoming;
  const fetchedAt = new Date().toISOString();

  return sliced.map((g): RawItem => ({
    sourceId: `${source.id}:${g.gameId}`,
    // The schedule page is the canonical place to land for this team —
    // individual game URLs change format season-to-season.
    sourceUrl: source.url,
    text: gameToText(g, /* isHome */ true),
    fetchedAt,
    venueName: g.arenaName,
    address: [g.arenaName, g.arenaCity, g.arenaState].filter(Boolean).join(", "),
  }));
}
