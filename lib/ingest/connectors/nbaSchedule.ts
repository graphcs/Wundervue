import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// NBA team home schedule via the public data.nba.com mobile feed — the same JSON
// nba.com/<slug>/schedule renders from (the page itself is a JS SPA with nothing
// scrapeable in its HTML). Emits only future HOME games at the team's own arena,
// so away games and neutral-site preseason games (which aren't in Denver) are
// excluded. Returns an empty list in the offseason, which keeps the source
// healthy until the next season's schedule is published. Configure with
// `connector: "nbaSchedule"`, `nbaTeamId` (Nuggets = 1610612743) and
// `nbaTeamSlug` ("nuggets").
//
// The feed is Akamai-fronted and 403s a generic User-Agent, so we send
// browser-like headers (same trick the page's own XHR uses).

interface NbaTeam {
  tid?: number;
  tc?: string; // team city ("Denver")
  tn?: string; // team nickname ("Nuggets")
}
interface NbaGame {
  gid?: string; // stable per-game id — used as the dedup source_id
  gdte?: string; // game date, home-local, YYYY-MM-DD
  gdtutc?: string; // game date in UTC, YYYY-MM-DD
  utctm?: string; // tip-off time in UTC, HH:MM
  an?: string; // arena name ("Ball Arena")
  ac?: string; // arena city ("Denver")
  st?: string; // status code ("3" = Final)
  stt?: string; // status text ("7:00 pm ET" | "Final" | "PPD")
  v?: NbaTeam; // visitor
  h?: NbaTeam; // home
}
interface NbaScheduleResponse {
  gscd?: { tid?: number; g?: NbaGame[] };
}

// data.nba.com keys schedules by the season's STARTING year (2025 → "2025-26").
// The next season's schedule publishes around August, so treat Aug–Dec as the
// new season and Jan–Jul as the season that started the previous calendar year.
function currentSeasonYear(now: Date): number {
  const month = Number(
    now.toLocaleString("en-US", { timeZone: "America/Denver", month: "numeric" }),
  );
  const year = Number(
    now.toLocaleString("en-US", { timeZone: "America/Denver", year: "numeric" }),
  );
  return month >= 8 ? year : year - 1;
}

// The feed gives UTC date + time; render venue-local so the normalizer extracts
// the right calendar day (a 01:00Z tip-off is the prior evening in Denver).
function localize(utcDate: string, utcTime: string): string {
  const iso = `${utcDate}T${utcTime}:00Z`;
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
    return `${utcDate} ${utcTime} UTC`;
  }
}

export async function fetchNbaSchedule(source: SourceConfig): Promise<RawItem[]> {
  const teamId = source.nbaTeamId;
  const slug = source.nbaTeamSlug;
  if (!teamId || !slug) {
    throw new Error(`source ${source.id} missing nbaTeamId or nbaTeamSlug`);
  }

  const now = new Date();
  const season = currentSeasonYear(now);
  const url =
    `https://data.nba.com/data/v2015/json/mobile_teams/nba/${season}` +
    `/teams/${slug}_schedule.json`;

  const games = await withRetry(async () => {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://www.nba.com/",
      },
    });
    if (!res.ok) throw new Error(`nba schedule fetch failed: status ${res.status}`);
    const json = (await res.json()) as NbaScheduleResponse;
    return json.gscd?.g ?? [];
  });

  // Denver "today" (YYYY-MM-DD) — gdte is already home-local, so a string
  // compare drops games before today without any timezone math.
  const todayDenver = now.toLocaleDateString("en-CA", { timeZone: "America/Denver" });

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const g of games) {
    if (!g.gid || !g.gdte) continue;
    // Home games at the team's own arena only. The home-team id drops away
    // games; the arena-city check additionally drops neutral-site preseason
    // games (e.g. a "home" preseason game played in San Diego).
    if (g.h?.tid !== teamId) continue;
    if (g.ac !== "Denver") continue;
    // Future games only — a past game already happened. "Final" status (st 3)
    // and a date before today both mean skip; also drop postponed/cancelled.
    if (g.gdte < todayDenver) continue;
    if (g.st === "3" || /final|ppd|postpon|cancel/i.test(g.stt ?? "")) continue;

    const sourceId = g.gid;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const home = `${g.h?.tc ?? ""} ${g.h?.tn ?? ""}`.trim() || "Home";
    const away = `${g.v?.tc ?? ""} ${g.v?.tn ?? ""}`.trim() || "Opponent";
    const venue = g.an ?? "Ball Arena";
    const when = g.gdtutc && g.utctm ? localize(g.gdtutc, g.utctm) : g.gdte;
    const text = [
      `${home} vs ${away}`,
      `Date: ${when}`,
      `Venue: ${venue}`,
      `NBA basketball game — ${home} home game at ${venue}.`,
    ].join("\n");

    out.push({
      sourceId,
      sourceUrl: `https://www.nba.com/${slug}/schedule`,
      text,
      fetchedAt,
      venueName: venue,
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
