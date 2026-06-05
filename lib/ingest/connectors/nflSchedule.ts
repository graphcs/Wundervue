import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// NFL team home schedule via ESPN's public site API — the same data the team's
// own schedule page renders from (denverbroncos.com is a JS SPA with nothing
// scrapeable in its HTML). ESPN's default team-schedule endpoint returns the
// current/upcoming season's slate, so there's no season string to maintain — it
// advances as the next schedule publishes. Emits only future HOME games at the
// team's own stadium, so away games and neutral-site "home" games (the annual
// international game in London/Munich, which is flagged homeAway:home but isn't
// in Denver) are excluded. Returns an empty list in the offseason gap before a
// schedule is released. Configure with `connector: "nflSchedule"`,
// `nflTeamAbbrev` ("DEN") and `url` (the team's public schedule page).

interface EspnTeamRef {
  abbreviation?: string;
  displayName?: string;
}
interface EspnCompetitor {
  homeAway?: string;
  team?: EspnTeamRef;
}
interface EspnVenue {
  fullName?: string;
  address?: { city?: string };
}
interface EspnStatusType {
  name?: string; // "STATUS_SCHEDULED" | "STATUS_FINAL" | "STATUS_CANCELED" | ...
  completed?: boolean;
}
interface EspnCompetition {
  venue?: EspnVenue;
  competitors?: EspnCompetitor[];
  status?: { type?: EspnStatusType };
}
interface EspnEvent {
  id?: string;
  date?: string; // ISO 8601 UTC, e.g. "2026-09-20T20:05Z"
  competitions?: EspnCompetition[];
}
interface EspnScheduleResponse {
  events?: EspnEvent[];
}

function teamName(t: EspnTeamRef | undefined, fallback: string): string {
  return t?.displayName?.trim() || fallback;
}

// ESPN gives a UTC instant; render venue-local so the normalizer extracts the
// right calendar day (a late kickoff can roll into the next UTC day).
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

export async function fetchNflSchedule(source: SourceConfig): Promise<RawItem[]> {
  const abbrev = source.nflTeamAbbrev;
  if (!abbrev) {
    throw new Error(`source ${source.id} missing nflTeamAbbrev`);
  }
  const publicUrl =
    (Array.isArray(source.url) ? source.url[0] : source.url) ??
    "https://www.nfl.com/schedules/";
  const apiUrl =
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbrev}/schedule`;

  const events = await withRetry(async () => {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`espn nfl fetch failed: status ${res.status}`);
    const json = (await res.json()) as EspnScheduleResponse;
    return json.events ?? [];
  });

  const now = new Date();
  const todayDenver = now.toLocaleDateString("en-CA", { timeZone: "America/Denver" });

  const fetchedAt = now.toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const e of events) {
    const comp = e.competitions?.[0];
    if (!e.id || !e.date || !comp) continue;
    const competitors = comp.competitors ?? [];
    const self = competitors.find((c) => c.team?.abbreviation === abbrev);
    const opp = competitors.find((c) => c.team?.abbreviation !== abbrev);
    // Home games at the team's own stadium only. The homeAway flag drops away
    // games; the Denver-city check additionally drops neutral-site/international
    // "home" games that shouldn't pin to Empower Field.
    if (self?.homeAway !== "home") continue;
    const venueName = comp.venue?.fullName ?? "";
    if (comp.venue?.address?.city !== "Denver") continue;
    // Future games only — drop completed, cancelled, and postponed games. The
    // event date (a UTC instant) is converted to its Denver calendar day so a
    // string compare against today's Denver date is exact.
    const gameDayDenver = new Date(e.date).toLocaleDateString("en-CA", {
      timeZone: "America/Denver",
    });
    if (gameDayDenver < todayDenver) continue;
    const statusName = comp.status?.type?.name ?? "";
    if (comp.status?.type?.completed || /cancel|postpon/i.test(statusName)) continue;

    const sourceId = e.id;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const home = teamName(self?.team, "Broncos");
    const away = teamName(opp?.team, "Opponent");
    const venue = venueName || "Empower Field at Mile High";
    const text = [
      `${home} vs ${away}`,
      `Date: ${localize(e.date)}`,
      `Venue: ${venue}`,
      `NFL football game — ${home} home game at ${venue}.`,
    ].join("\n");

    out.push({
      sourceId,
      sourceUrl: publicUrl,
      text,
      fetchedAt,
      venueName: venue,
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
