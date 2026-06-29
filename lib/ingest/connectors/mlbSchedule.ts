import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { localizeDenver } from "./localize";

// MLB team schedule via the public StatsAPI (the same feed mlb.com itself uses).
// Pulls a rolling forward window from today so it auto-advances each run — no
// per-month URLs to maintain. Only HOME games are emitted (away games aren't at
// the team's local venue, so they shouldn't pin to it). Configure with
// `connector: "mlbSchedule"` and `mlbTeamId` (Rockies = 115).
const WINDOW_DAYS = 150;
// Exclude non-counting game types: Spring Training, Exhibition, All-Star. Keep
// regular season ("R") and postseason ("F"/"D"/"L"/"W"/"P"/"C").
const SKIP_GAME_TYPES = new Set(["S", "E", "A"]);

interface StatsApiTeam {
  team?: { id?: number; name?: string };
}
interface StatsApiGame {
  gamePk?: number;
  gameDate?: string;
  gameType?: string;
  seriesDescription?: string;
  status?: { detailedState?: string };
  teams?: { home?: StatsApiTeam; away?: StatsApiTeam };
  venue?: { name?: string };
  // Per-game ticketing (hydrate=game(tickets)) — ticketLinks.home is the
  // official per-game purchase URL (Ticketmaster for MLB).
  tickets?: Array<{ ticketType?: string; ticketLinks?: { home?: string } }>;
}
interface StatsApiResponse {
  dates?: Array<{ games?: StatsApiGame[] }>;
}

export async function fetchMlbSchedule(source: SourceConfig): Promise<RawItem[]> {
  const teamId = source.mlbTeamId;
  if (!teamId) throw new Error(`source ${source.id} missing mlbTeamId`);

  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);
  const endDate = new Date(today.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const url =
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}` +
    `&startDate=${startDate}&endDate=${endDate}&hydrate=game(tickets)`;

  const games = await withRetry(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`statsapi fetch failed: status ${res.status}`);
    const json = (await res.json()) as StatsApiResponse;
    return (json.dates ?? []).flatMap((d) => d.games ?? []);
  });

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const g of games) {
    // Home games only — away games aren't at this team's venue.
    if (g.teams?.home?.team?.id !== teamId) continue;
    if (!g.gameDate || !g.gamePk) continue;
    // Skip spring training / exhibition / all-star, and cancelled/postponed
    // games (they'd otherwise show as live events pinned to the home venue).
    if (g.gameType && SKIP_GAME_TYPES.has(g.gameType)) continue;
    if (/cancel|postpon/i.test(g.status?.detailedState ?? "")) continue;
    const sourceId = String(g.gamePk);
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const home = g.teams?.home?.team?.name ?? "Home";
    const away = g.teams?.away?.team?.name ?? "Opponent";
    const venue = g.venue?.name ?? "";
    const text = [
      `${home} vs ${away}`,
      `Date: ${localizeDenver(g.gameDate)}`,
      venue && `Venue: ${venue}`,
      `${g.seriesDescription ?? "MLB"} baseball game — ${home} home game.`,
    ]
      .filter(Boolean)
      .join("\n");

    out.push({
      sourceId,
      // Team-agnostic link (the StatsAPI doesn't give a per-team web slug here).
      sourceUrl: "https://www.mlb.com/schedule",
      // Per-game purchase URL → the "Buy Tickets" CTA.
      ticketUrl: g.tickets?.find((t) => t.ticketLinks?.home)?.ticketLinks?.home,
      text,
      fetchedAt,
      venueName: venue || undefined,
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
