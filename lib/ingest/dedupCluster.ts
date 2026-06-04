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
  return shortWords >= 3 && long.startsWith(short + " ");
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
  date_start: string | null;
  created_at: string;
}

// Canonical preference within a cluster: an upcoming dated row (soonest) wins so
// the surviving card shows the next occurrence; then undated (ongoing); then a
// past dated row last (so an ongoing "Now Open" beats a stale dated post that
// the expire-past job would later hide).
function canonicalRank(r: VenueRow, now: number): [number, number] {
  if (r.date_start) {
    const t = Date.parse(r.date_start);
    if (!Number.isNaN(t)) return t >= now ? [0, t] : [2, t];
  }
  return [1, Date.parse(r.created_at)];
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
      .select("id, title, date_start, created_at")
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

      cluster.sort((a, b) => {
        const [ta, va] = canonicalRank(a, now);
        const [tb, vb] = canonicalRank(b, now);
        return ta !== tb ? ta - tb : va - vb;
      });
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
      const canonical = rows[0];
      const dupIds = rows.slice(1).map((r) => r.id);

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
