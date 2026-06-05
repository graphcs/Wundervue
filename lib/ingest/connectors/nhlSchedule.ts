import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// NHL team home schedule via the public api-web.nhle.com club schedule feed —
// the same data nhl.com/<slug>/schedule renders from (the page is a JS SPA with
// nothing scrapeable in its HTML). The `/now` endpoint resolves the current
// season automatically, so there's no season string or per-month date to
// maintain — it just advances as NHL publishes the next schedule. Emits only
// future HOME games at the team's own arena, so away games and neutral-site
// games (Global Series, Stadium Series, etc.) are excluded. Returns an empty
// list in the offseason, which keeps the source healthy. Configure with
// `connector: "nhlSchedule"`, `nhlTeamAbbrev` ("COL") and `nhlTeamSlug`
// ("avalanche").

interface NhlTeam {
  abbrev?: string;
  commonName?: { default?: string }; // "Avalanche"
  placeName?: { default?: string }; // "Colorado"
}
interface NhlGame {
  id?: number; // stable per-game id — used as the dedup source_id
  gameType?: number; // 1 preseason, 2 regular, 3 playoffs
  gameDate?: string; // venue-local date, YYYY-MM-DD
  startTimeUTC?: string; // ISO 8601 with Z
  venue?: { default?: string }; // "Ball Arena"
  gameState?: string; // "FUT" | "PRE" | "LIVE" | "FINAL" | "OFF"
  gameScheduleState?: string; // "OK" | "PPD" | "CNCL" | "SUSP"
  homeTeam?: NhlTeam;
  awayTeam?: NhlTeam;
}
interface NhlScheduleResponse {
  currentSeason?: number;
  games?: NhlGame[];
}

// A game that has already happened (or won't happen). Future games are "FUT"/
// "PRE"/"LIVE"; "FINAL"/"OFF" are done.
const PAST_STATES = new Set(["FINAL", "OFF"]);

function teamName(t: NhlTeam | undefined, fallback: string): string {
  return (
    [t?.placeName?.default, t?.commonName?.default].filter(Boolean).join(" ") ||
    fallback
  );
}

// startTimeUTC is a real UTC instant; render venue-local so the normalizer
// extracts the right calendar day (a 01:30Z puck drop is the prior evening in
// Denver).
function localize(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Denver",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export async function fetchNhlSchedule(source: SourceConfig): Promise<RawItem[]> {
  const abbrev = source.nhlTeamAbbrev;
  const slug = source.nhlTeamSlug;
  if (!abbrev || !slug) {
    throw new Error(`source ${source.id} missing nhlTeamAbbrev or nhlTeamSlug`);
  }

  const url = `https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/now`;

  const games = await withRetry(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`nhl schedule fetch failed: status ${res.status}`);
    const json = (await res.json()) as NhlScheduleResponse;
    return json.games ?? [];
  });

  // Denver "today" (YYYY-MM-DD) — gameDate is already venue-local, so a string
  // compare drops games before today without any timezone math.
  const now = new Date();
  const todayDenver = now.toLocaleDateString("en-CA", { timeZone: "America/Denver" });

  const fetchedAt = now.toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const g of games) {
    if (!g.id || !g.gameDate) continue;
    // Home games at the team's own arena only. The home-team abbrev drops away
    // games; the Ball Arena check additionally drops neutral-site games (Global
    // Series, Stadium Series) that shouldn't pin to the home venue.
    if (g.homeTeam?.abbrev !== abbrev) continue;
    if (g.venue?.default !== "Ball Arena") continue;
    // Future games only — drop past/archived, postponed, and cancelled games.
    if (g.gameDate < todayDenver) continue;
    if (g.gameState && PAST_STATES.has(g.gameState)) continue;
    if (g.gameScheduleState && g.gameScheduleState !== "OK") continue;

    const sourceId = String(g.id);
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const home = teamName(g.homeTeam, "Avalanche");
    const away = teamName(g.awayTeam, "Opponent");
    const venue = g.venue?.default ?? "Ball Arena";
    const when = g.startTimeUTC ? localize(g.startTimeUTC) : g.gameDate;
    const text = [
      `${home} vs ${away}`,
      `Date: ${when}`,
      `Venue: ${venue}`,
      `NHL hockey game — ${home} home game at ${venue}.`,
    ].join("\n");

    out.push({
      sourceId,
      sourceUrl: `https://www.nhl.com/${slug}/schedule`,
      text,
      fetchedAt,
      venueName: venue,
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
