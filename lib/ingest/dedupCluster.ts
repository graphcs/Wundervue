import type Anthropic from "@anthropic-ai/sdk";
import { buildOpenRouterClient, resolveModel } from "./normalize";
import { getServiceClient } from "./persist";
import { withRetry } from "./retry";

const TOOL_NAME = "cluster_duplicates";
const MAX_CANDIDATES_PER_DAY = 40;
const NEW_ROW_LOOKBACK_MS = 10 * 60 * 1000;

interface CandidateRow {
  id: string;
  title: string;
  description: string;
  source: string;
  venue_id: string | null;
  address: string | null;
  date_start: string | null;
  event_key: string;
  created_at: string;
}

const TOOL_SCHEMA = {
  name: TOOL_NAME,
  description:
    "Group near-duplicate events that describe the same real-world event. Each inner array is one cluster of indices into the candidate list. Single-item clusters may be omitted.",
  input_schema: {
    type: "object",
    required: ["groups"],
    properties: {
      groups: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" },
          minItems: 2,
        },
      },
    },
  },
} satisfies Anthropic.Tool;

interface ClusterResult {
  groups: number[][];
}

export async function clusterCandidates(
  candidates: CandidateRow[],
  client?: Anthropic,
): Promise<ClusterResult> {
  if (candidates.length < 2) return { groups: [] };
  const anthropic = client ?? buildOpenRouterClient();

  const lines = candidates
    .map(
      (r, i) =>
        `[${i}] source=${r.source} title="${r.title}" venue_id=${r.venue_id ?? "(none)"} address="${(r.address ?? "(none)").slice(0, 80)}" date=${r.date_start ?? "(none)"} desc="${r.description.slice(0, 200)}"`,
    )
    .join("\n");

  const response: Anthropic.Message = await withRetry(() =>
    anthropic.messages.create({
      model: resolveModel(),
      max_tokens: 1024,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "tool", name: TOOL_NAME },
      system: [
        "You cluster duplicate event listings from multiple data sources.",
        "Two listings are DUPLICATES only when they describe the SAME real-world event:",
        "- Same artist/performer/topic AND same venue (or address) AND same date.",
        "- A title like \"Sundressed at Oskar Blues\" and just \"Sundressed\" on the same day at the same venue ARE duplicates.",
        "- A show by the same artist on a different day or at a different venue is NOT a duplicate.",
        "- A farmers market that recurs every Saturday is NOT a duplicate of itself across different Saturdays.",
        "- Different events at the same venue on the same day (e.g., afternoon vs. evening show) are NOT duplicates.",
        "When in doubt, do NOT cluster — false positives hide real events from users.",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: `Candidates that share the same calendar day:\n${lines}\n\nReturn duplicate groups as arrays of indices. Omit any group of size 1.`,
        },
      ],
    }),
  );

  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
  );
  if (!block) return { groups: [] };
  const input = block.input as { groups?: number[][] };
  return { groups: input.groups ?? [] };
}

interface MarkResult {
  comparedGroups: number;
  markedDuplicate: number;
}

const VENUE_TITLE_LOOKBACK_MS = 10 * 60 * 1000;
const MAX_VENUE_CANDIDATES = 200;

// Normalize a title for near-duplicate comparison: lowercase, strip accents and
// punctuation, collapse whitespace, drop a leading "the".
function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // Drop a trailing parenthetical time-of-day qualifier so two sessions of one
    // event merge \u2014 "\u2026(Morning)" / "\u2026(Afternoon)" / "\u2026(Evening Cohort)" \u2014 while
    // leaving real content variants ("(Beginner)", "(21+)") distinct.
    .replace(
      /\s*[([{]\s*(morning|afternoon|evening|night|matinee|noon|early|late|am|pm)(\s+(cohort|session|seating|show|set|class))?\s*[)\]}]\s*$/,
      "",
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the\s+/, "");
}

// Two titles are "near-identical" when they're equal after normalization, or
// one is a word-boundary prefix of the other (e.g. "Call of the Dolphins" vs
// "Call of the Dolphins — Now Playing"). The prefix side must be >= 3 words so
// short generic stems ("Yoga", "Trivia Night") don't collapse unrelated events.
function titlesNearIdentical(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  const shortWords = short.split(" ").filter(Boolean).length;
  if (shortWords >= 3 && long.startsWith(short + " ")) return true;
  // Same show titled differently across sources (a flyer's "Yacht Rock Party ft.
  // DJ Fa'dorah" vs a calendar's "Yacht Rock on the Roof with DJ Fa'dorah"): merge
  // when one title's distinctive tokens (generic words dropped) are ALL contained
  // in the other's, with ≥2 shared. The caller gates this to same venue +
  // mergeable dates, so the false-merge surface is small.
  const ta = subjectTokens(a);
  const tb = subjectTokens(b);
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  return small.size >= 2 && [...small].every((w) => big.has(w));
}

// Significant title tokens for the LLM-cluster safety net: drop generic words so
// shared "the/at/film/show" can't make unrelated events look related.
const TITLE_GENERIC = new Set([
  "the", "a", "an", "at", "of", "and", "with", "for", "to", "in", "on", "by",
  "presents", "present", "feat", "featuring", "live", "show", "shows", "screening",
  "film", "films", "movie", "movies", "night", "series", "event", "party", "day",
]);
function subjectTokens(t: string): Set<string> {
  return new Set(
    normalizeTitle(t)
      .split(" ")
      .filter((w) => w.length >= 3 && !TITLE_GENERIC.has(w)),
  );
}

// LLM-cluster safety net. A model can over-merge distinct events that merely
// share a venue + day — e.g. two different films screening the same afternoon at
// a multi-screen cinema (Sie FilmCenter). Only accept a model-proposed duplicate
// when its title plausibly names the same subject as the canonical: identical,
// one contains the other, or they share a significant (non-generic) token.
// Blocks "Girls Like Girls" vs "Sie/Saw: Castration Movie Anthology II" while
// still allowing "Sundressed at Oskar Blues" vs "Sundressed".
function titlesShareSubject(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  // Empty titles fall through the substring check ("".includes("") === true),
  // so a missing title safely defers to the model rather than blocking.
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = subjectTokens(a);
  const tb = subjectTokens(b);
  if (ta.size === 0 || tb.size === 0) return true;
  return [...ta].some((w) => tb.has(w));
}

// Same-title rows only merge when they plausibly describe ONE event: either side
// undated (an ongoing exhibition / "Now Showing" / "<UNKNOWN>" repost — the main
// Instagram duplication case) or both on the SAME calendar day. Distinct dated
// occurrences stay separate, so neither a recurring series (weekly "Yoga on the
// Rocks") nor a multi-night run (Paul Simon Jun 12 AND Jun 13) gets collapsed.
function datesMergeable(a: string | null, b: string | null): boolean {
  if (!a || !b) return true;
  return a.slice(0, 10) === b.slice(0, 10);
}

interface VenueRow {
  id: string;
  title: string;
  source: string;
  date_start: string | null;
  created_at: string;
  time_display: string | null;
  deal_value: string | null;
}

// A time_display that is a single clock time, e.g. "7:00 PM" → minutes past
// midnight. Returns null for ranges ("7:00 PM – 9:00 PM"), "All day", recurring
// labels, or already-combined strings ("7:00 PM & 9:30 PM"), so we never mangle
// those.
const CLOCK_RE = /^\s*(\d{1,2}):(\d{2})\s*([AP]M)\s*$/i;
function clockMinutes(s: string | null): number | null {
  if (!s) return null;
  const m = CLOCK_RE.exec(s);
  if (!m) return null;
  const h = parseInt(m[1], 10) % 12;
  const pm = /pm/i.test(m[3]);
  return (h + (pm ? 12 : 0)) * 60 + parseInt(m[2], 10);
}

// When a same-day cluster collapses multiple showtimes of one event into a
// single card (e.g. a comedian's 7:00 and 9:30 PM shows), surface every distinct
// clock time on the surviving listing — "7:00 PM & 9:30 PM" — instead of hiding
// the later show. Returns null (leave time_display as-is) unless every member is
// dated on the SAME day and carries a parseable single clock time, and there are
// 2+ distinct times.
function combinedShowtimes(
  members: Array<{ date_start: string | null; time_display: string | null }>,
): string | null {
  const days = new Set<string>();
  const byMinute = new Map<number, string>();
  for (const r of members) {
    if (!r.date_start) return null;
    days.add(r.date_start.slice(0, 10));
    const mins = clockMinutes(r.time_display);
    if (mins === null) return null;
    if (!byMinute.has(mins)) byMinute.set(mins, r.time_display!.trim());
  }
  if (days.size !== 1 || byMinute.size < 2) return null;
  return [...byMinute.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, label]) => label)
    .join(" & ");
}

// Authoritative-source ranking for choosing which row in a duplicate cluster is
// the visible one. A ticketing/venue Website (and Meetup) carries the real
// showtime, ticket link, and event art, so it beats a social repost of the same
// event. Higher = preferred.
function sourcePriority(source: string): number {
  switch (source) {
    case "Website":
      return 3;
    case "Meetup":
      return 2;
    case "Instagram":
      return 1;
    default:
      return 2;
  }
}

// Canonical preference within a duplicate cluster, best first (sortable
// ascending): keep the date first (upcoming dated > undated > past dated, so we
// never trade a dated row for an undated one), THEN the most authoritative
// source (a venue Website with its showtime + ticket link + art beats a social
// repost), THEN the soonest dated / earliest created. Used everywhere a cluster
// picks its survivor.
type RankInput = {
  source: string;
  date_start: string | null;
  created_at: string;
  time_display?: string | null;
  deal_value?: string | null;
};
function canonicalRank(r: RankInput, now: number): [number, number, number, number, number] {
  let dateTier = 1; // undated
  let timeVal = Date.parse(r.created_at);
  if (r.date_start) {
    const t = Date.parse(r.date_start);
    if (!Number.isNaN(t)) {
      dateTier = t >= now ? 0 : 2;
      timeVal = t;
    }
  }
  // Among same-date, same-source duplicates, prefer the more complete row — one
  // that captured a time, then one that captured a deal/price — so the visible
  // canonical keeps the richer info (e.g. a flyer's "$10 cover" survives over a
  // calendar copy of the same show that has neither).
  const hasTime = (r.time_display ?? "").trim() ? 0 : 1;
  const hasDeal = (r.deal_value ?? "").trim() ? 0 : 1;
  return [dateTier, -sourcePriority(r.source), hasTime, hasDeal, timeVal];
}

function byCanonicalRank(now: number): (a: RankInput, b: RankInput) => number {
  return (a, b) => {
    const ra = canonicalRank(a, now);
    const rb = canonicalRank(b, now);
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2] || ra[3] - rb[3] || ra[4] - rb[4];
  };
}

interface ClusterRow {
  id: string;
  source: string;
  date_start: string | null;
  time_display: string | null;
  deal_value: string | null;
  created_at: string;
  dedup_of: string | null;
  published_at: string | null;
}

// Per-venue reconciliation over each EXISTING duplicate cluster (rows that share
// a dedup_of canonical), in a single pass over the venue's rows. Two jobs:
//   1. Re-point the cluster so the most authoritative source is the visible
//      canonical (a venue Website beats an Instagram repost of the same show),
//      healing clusters an earlier pass canonicalized first-write-wins.
//   2. Roll same-day duplicate showtimes onto the canonical's time_display
//      ("7:00 PM & 9:30 PM") so a merged-away showtime isn't lost.
// It only re-orders WITHIN clusters already formed by dedup_of — it never merges
// new rows — so it's safe and idempotent across re-ingests (which reset rows the
// prior passes hid). Driven from the orchestrator per batch venue.
export async function reconcileVenueDuplicates(venueIds: string[]): Promise<void> {
  const client = getServiceClient();
  const rank = byCanonicalRank(Date.now());
  for (const venueId of venueIds) {
    const { data, error } = await client
      .from("listings")
      .select("id, source, date_start, time_display, deal_value, created_at, dedup_of, published_at")
      .eq("venue_id", venueId);
    if (error) throw new Error(`venue dedup reconcile fetch failed: ${error.message}`);
    const rows = (data ?? []) as ClusterRow[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const dupsByCanonical = new Map<string, ClusterRow[]>();
    for (const r of rows) {
      if (!r.dedup_of) continue;
      const arr = dupsByCanonical.get(r.dedup_of) ?? [];
      arr.push(r);
      dupsByCanonical.set(r.dedup_of, arr);
    }
    for (const [canonId, dups] of dupsByCanonical) {
      const canon = byId.get(canonId);
      // Skip a missing or itself-demoted canonical (malformed/chained cluster).
      if (!canon || canon.dedup_of) continue;
      const cluster = [canon, ...dups];

      // 1. Re-point to the most authoritative survivor.
      const best = [...cluster].sort(rank)[0];
      if (best.id !== canonId) {
        // Promote `best` (preserve its published_at so we don't fire a false
        // "new drop"); demote everyone else under it.
        const { error: upErr } = await client
          .from("listings")
          .update({ published_at: best.published_at ?? canon.published_at, dedup_of: null })
          .eq("id", best.id);
        if (upErr) throw new Error(`canonical promote failed: ${upErr.message}`);
        const demoteIds = cluster.filter((r) => r.id !== best.id).map((r) => r.id);
        const { error: dErr } = await client
          .from("listings")
          .update({ published_at: null, dedup_of: best.id })
          .in("id", demoteIds);
        if (dErr) throw new Error(`canonical demote failed: ${dErr.message}`);
      }

      // 2. Roll same-day showtimes onto the (effective) canonical.
      const combined = combinedShowtimes(cluster);
      if (combined && combined !== best.time_display) {
        const { error: tErr } = await client
          .from("listings")
          .update({ time_display: combined })
          .eq("id", best.id);
        if (tErr) throw new Error(`showtime merge update failed: ${tErr.message}`);
      }
    }
  }
}

// Merge near-identical-title duplicates within each given venue, regardless of
// which calendar day they fall on. Complements clusterAndMarkDuplicates (which
// is same-day only) to catch the same exhibition/event posted to Instagram
// multiple times with different (or no) dates. Exported for direct invocation.
export async function mergeVenueTitleDuplicatesForVenues(
  venueIds: string[],
): Promise<MarkResult> {
  const client = getServiceClient();
  const now = Date.now();
  let comparedGroups = 0;
  let markedDuplicate = 0;

  for (const venueId of venueIds) {
    const { data, error } = await client
      .from("listings")
      .select("id, title, source, date_start, created_at, time_display, deal_value")
      .eq("venue_id", venueId)
      .not("published_at", "is", null)
      .is("dedup_of", null)
      // Dated rows first (soonest first), undated last. This ordering is what
      // makes the greedy clustering safe: a dated row always seeds its cluster,
      // so two distinct dates never merge (datesMergeable is false across days)
      // and an undated same-title row can only attach to one dated cluster
      // rather than bridging every occurrence of a recurring series.
      .order("date_start", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(MAX_VENUE_CANDIDATES);
    if (error) throw new Error(`venue-title dedup fetch failed: ${error.message}`);
    const cand = (data ?? []) as VenueRow[];
    if (cand.length < 2) continue;

    const used = new Set<string>();
    for (let i = 0; i < cand.length; i++) {
      if (used.has(cand[i].id)) continue;
      const cluster = [cand[i]];
      for (let j = i + 1; j < cand.length; j++) {
        if (used.has(cand[j].id)) continue;
        if (
          titlesNearIdentical(cand[i].title, cand[j].title) &&
          datesMergeable(cand[i].date_start, cand[j].date_start)
        ) {
          cluster.push(cand[j]);
          used.add(cand[j].id);
        }
      }
      used.add(cand[i].id);
      if (cluster.length < 2) continue;
      comparedGroups++;

      cluster.sort(byCanonicalRank(now));
      const canonical = cluster[0];
      const dupIds = cluster.slice(1).map((r) => r.id);
      const { error: markErr } = await client
        .from("listings")
        .update({ published_at: null, dedup_of: canonical.id })
        .in("id", dupIds);
      if (markErr) throw new Error(`venue-title dedup mark failed: ${markErr.message}`);
      markedDuplicate += dupIds.length;
    }
  }
  return { comparedGroups, markedDuplicate };
}

// Run the venue-title dedup for the venues touched by the just-finished run.
export async function mergeVenueTitleDuplicates(
  newSourceLabel: string,
): Promise<MarkResult> {
  const client = getServiceClient();
  const since = new Date(Date.now() - VENUE_TITLE_LOOKBACK_MS).toISOString();
  const { data, error } = await client
    .from("listings")
    .select("venue_id")
    .eq("source", newSourceLabel)
    .gte("created_at", since)
    .not("venue_id", "is", null)
    .not("published_at", "is", null);
  if (error) throw new Error(`venue-title dedup (recent venues) failed: ${error.message}`);
  const venueIds = [...new Set((data ?? []).map((r) => (r as { venue_id: string }).venue_id))];
  if (venueIds.length === 0) return { comparedGroups: 0, markedDuplicate: 0 };
  return mergeVenueTitleDuplicatesForVenues(venueIds);
}

export async function clusterAndMarkDuplicates(
  newSourceLabel: string,
): Promise<MarkResult> {
  const client = getServiceClient();

  // Step 1: figure out which calendar days were touched by this run. We use a
  // short lookback window on `created_at` rather than tracking inserted IDs;
  // any row from the same source created in the last few minutes is from this
  // ingestion (orchestrator runs sequentially per source).
  const recentSince = new Date(Date.now() - NEW_ROW_LOOKBACK_MS).toISOString();
  const { data: recent, error: e1 } = await client
    .from("listings")
    .select("date_start")
    .eq("source", newSourceLabel)
    .gte("created_at", recentSince)
    .not("published_at", "is", null)
    .not("date_start", "is", null);
  if (e1) throw new Error(`cluster fetch (recent days) failed: ${e1.message}`);
  const recentRows = (recent ?? []) as Array<{ date_start: string }>;
  if (recentRows.length === 0) return { comparedGroups: 0, markedDuplicate: 0 };

  const days = new Set<string>();
  for (const r of recentRows) days.add(r.date_start.slice(0, 10));

  let comparedGroups = 0;
  let markedDuplicate = 0;

  for (const day of days) {
    const dayStart = `${day}T00:00:00Z`;
    const dayEnd = `${day}T23:59:59Z`;

    // Step 2: fetch ALL published listings on this day, regardless of source
    // or venue match. This catches duplicates between SerpAPI events that
    // didn't get a venue_id and other rows on the same day.
    const { data: cluster, error: e2 } = await client
      .from("listings")
      .select(
        "id, title, description, source, venue_id, address, date_start, event_key, created_at",
      )
      .gte("date_start", dayStart)
      .lte("date_start", dayEnd)
      .not("published_at", "is", null)
      .order("created_at", { ascending: true })
      .limit(MAX_CANDIDATES_PER_DAY);
    if (e2) throw new Error(`cluster fetch (group) failed: ${e2.message}`);
    const candidates = (cluster ?? []) as CandidateRow[];
    if (candidates.length < 2) continue;

    // Skip when every row already shares an event_key — deterministic dedup
    // already handled it.
    const distinctKeys = new Set(candidates.map((c) => c.event_key));
    if (distinctKeys.size < 2) continue;

    const result = await clusterCandidates(candidates);
    comparedGroups++;

    for (const group of result.groups) {
      if (group.length < 2) continue;
      const rows = group
        .map((i) => candidates[i])
        .filter((r): r is CandidateRow => Boolean(r));
      if (rows.length < 2) continue;
      rows.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      // The same event offered at several branches the same day (e.g. a library
      // "Open Lab" at every location) collapses to one card — product choice to
      // keep the grid clean rather than show near-identical per-branch cards.
      const canonical = rows[0];
      // Drop any model-proposed member whose title shares no subject with the
      // canonical — guards against same-venue/same-day over-merges (e.g. two
      // different films at a multi-screen cinema).
      const dupIds = rows
        .slice(1)
        .filter((r) => {
          if (titlesShareSubject(canonical.title, r.title)) return true;
          console.warn(
            `[cluster] rejected merge of "${r.title}" into "${canonical.title}" (titles share no subject)`,
          );
          return false;
        })
        .map((r) => r.id);
      if (dupIds.length === 0) continue;
      const { error: e3 } = await client
        .from("listings")
        .update({ published_at: null, dedup_of: canonical.id })
        .in("id", dupIds);
      if (e3) throw new Error(`mark duplicates failed: ${e3.message}`);
      markedDuplicate += dupIds.length;
    }
  }

  return { comparedGroups, markedDuplicate };
}
