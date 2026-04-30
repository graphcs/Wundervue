import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import type {
  DbListing,
  DedupAction,
  IngestResult,
  ListingInsert,
  NormalizedListing,
  RawItem,
  SourceConfig,
} from "./types";
import { eventKey, makeSlug } from "./dedup";

let cachedClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  cachedClient = createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export interface VenueRow {
  id: string;
  slug: string;
  name: string;
  address: string;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
}

export async function resolveVenue(slug: string | undefined): Promise<VenueRow | null> {
  if (!slug) return null;
  const client = getServiceClient();
  const { data, error } = await client
    .from("venues")
    .select("id, slug, name, address, neighborhood, lat, lng")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`venue lookup failed for ${slug}: ${error.message}`);
  return (data as VenueRow | null) ?? null;
}

export function buildListingInsert(args: {
  source: SourceConfig;
  item: RawItem;
  normalized: NormalizedListing;
  venue: VenueRow | null;
}): ListingInsert {
  const { source, item, normalized, venue } = args;
  const key = eventKey({
    canonicalTitle: normalized.canonicalTitle,
    venueId: venue?.id ?? null,
    dateStart: normalized.dateStart,
  });
  return {
    slug: makeSlug(normalized.title, `${source.sourceLabel}:${item.sourceId}`),
    type: normalized.type,
    title: normalized.title,
    description: normalized.description,
    venue_id: venue?.id ?? null,
    address: venue?.address ?? null,
    // For venue-bound sources, the venue's neighborhood is authoritative —
    // the LLM tends to default to "Downtown" when the caption doesn't say.
    neighborhood: venue?.neighborhood || normalized.neighborhood || null,
    category: normalized.category || source.defaultCategory || null,
    date_start: normalized.dateStart,
    date_end: normalized.dateEnd,
    date_display: normalized.dateDisplay || null,
    time_display: normalized.timeDisplay || null,
    is_free: normalized.isFree,
    deal_value: normalized.dealValue,
    image_url: item.imageUrl ?? null,
    image_source: null,
    source: source.sourceLabel,
    source_url: item.sourceUrl ?? null,
    source_id: item.sourceId,
    event_key: key,
    dedup_of: null,
    tags: normalized.tags,
    lat: venue?.lat ?? null,
    lng: venue?.lng ?? null,
    published_at: new Date().toISOString(),
  };
}

interface ExistingRow {
  id: string;
  source: string;
  source_id: string;
  event_key: string;
}

export async function classifyForUpsert(rows: ListingInsert[]): Promise<DedupAction[]> {
  if (rows.length === 0) return [];
  const client = getServiceClient();

  // Same-source lookup: existing rows with matching (source, source_id).
  // Filter by source as well — without it, an Instagram shortcode or a
  // venue-defaulted slug could pull a row from a different source that
  // happens to share the same source_id string. Each connector batch is
  // single-source today; if that ever changes, the loop below issues one
  // query per distinct source rather than mixing them.
  const idsBySource = new Map<string, string[]>();
  for (const r of rows) {
    const arr = idsBySource.get(r.source) ?? [];
    arr.push(r.source_id);
    idsBySource.set(r.source, arr);
  }

  const sameMap = new Map<string, ExistingRow>();
  for (const [sourceLabel, ids] of idsBySource) {
    const { data, error } = await client
      .from("listings")
      .select("id, source, source_id, event_key")
      .eq("source", sourceLabel)
      .in("source_id", ids);
    if (error) throw new Error(`existing-same lookup failed: ${error.message}`);
    for (const row of (data ?? []) as ExistingRow[]) {
      sameMap.set(`${row.source}|${row.source_id}`, row);
    }
  }

  // event_key lookup: any published row with a matching event_key is a
  // duplicate of this incoming row, whether it came from a different source
  // or from the same source under a different source_id (e.g. when an
  // upstream connector emits two distinct ids for the same logical event).
  const eventKeys = rows.map((r) => r.event_key);
  const { data: existingByKey, error: e2 } = await client
    .from("listings")
    .select("id, source, source_id, event_key, published_at")
    .in("event_key", eventKeys);
  if (e2) throw new Error(`existing-by-key lookup failed: ${e2.message}`);

  const byKeyMap = new Map<string, ExistingRow & { published_at: string | null }>();
  for (const row of (existingByKey ?? []) as Array<ExistingRow & { published_at: string | null }>) {
    if (row.published_at !== null) byKeyMap.set(row.event_key, row);
  }

  return rows.map((row): DedupAction => {
    const sameKey = `${row.source}|${row.source_id}`;
    const sameMatch = sameMap.get(sameKey);
    if (sameMatch) {
      return { kind: "update", row, existingId: sameMatch.id };
    }
    const crossMatch = byKeyMap.get(row.event_key);
    if (crossMatch) {
      // Same source produced a new source_id for a row that already exists
      // under an old source_id (most often a connector keying algorithm
      // change). Merging into the canonical preserves its id (and any
      // dedup_of pointers from other rows) while refreshing content and
      // adopting the new source_id format.
      if (crossMatch.source === row.source) {
        return { kind: "merge", row, existingId: crossMatch.id };
      }
      // Different source reporting the same event — first-write-wins;
      // the new row gets hidden under the canonical.
      return {
        kind: "skip-duplicate",
        row: { ...row, published_at: null, dedup_of: crossMatch.id },
        canonicalId: crossMatch.id,
      };
    }
    return { kind: "insert", row };
  });
}

export async function applyBatch(actions: DedupAction[]): Promise<{
  inserted: number;
  updated: number;
  duplicate: number;
}> {
  if (actions.length === 0) return { inserted: 0, updated: 0, duplicate: 0 };
  const client = getServiceClient();

  // Merge actions need an id-based UPDATE — the upsert path keys on
  // (source, source_id), and a merge by definition is rewriting source_id
  // on the canonical row, so onConflict can't find it. Process those
  // separately. The remaining actions go through the bulk upsert.
  const merges = actions.filter((a): a is Extract<DedupAction, { kind: "merge" }> =>
    a.kind === "merge",
  );
  const upsertable = actions.filter((a) => a.kind !== "merge");

  if (upsertable.length > 0) {
    const toUpsert = upsertable.map((a) => a.row);
    const { error } = await client
      .from("listings")
      .upsert(toUpsert, { onConflict: "source,source_id" });
    if (error) throw new Error(`upsert failed: ${error.message}`);
  }

  for (const m of merges) {
    const { error } = await client
      .from("listings")
      .update(m.row)
      .eq("id", m.existingId);
    if (error) throw new Error(`merge update failed for ${m.existingId}: ${error.message}`);
  }

  let inserted = 0;
  let updated = 0;
  let duplicate = 0;
  for (const a of actions) {
    if (a.kind === "insert") inserted++;
    else if (a.kind === "update" || a.kind === "merge") updated++;
    else duplicate++;
  }
  return { inserted, updated, duplicate };
}

export async function startRun(sourceId: string, attempt: number): Promise<string> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("source_runs")
    .insert({ source_id: sourceId, status: "running", attempt })
    .select("id")
    .single();
  if (error) throw new Error(`start run failed: ${error.message}`);
  return (data as { id: string }).id;
}

export async function finishRun(runId: string, result: IngestResult): Promise<void> {
  const client = getServiceClient();
  const { error } = await client
    .from("source_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: result.status,
      items_seen: result.itemsSeen,
      items_inserted: result.itemsInserted,
      items_updated: result.itemsUpdated,
      items_duplicate: result.itemsDuplicate,
      error: result.error ?? null,
    })
    .eq("id", runId);
  if (error) throw new Error(`finish run failed: ${error.message}`);
}

// Insert a fresh row marked status='failed' when the normal finishRun UPDATE
// path itself fails (e.g. the original 'running' row is stuck because the
// post-work write blew up). Without this, recentFailureStreak would only
// trip the auto-disable guard once the original row aged past
// STALE_RUNNING_MS (1h) — leaving a window where a hard-broken source keeps
// retrying every cron tick. With the sentinel, the streak guard sees a
// failure on the next run regardless of whether the original row ever
// finishes its UPDATE.
export async function writeFailedRunSentinel(
  sourceId: string,
  attempt: number,
  reason: string,
): Promise<void> {
  const client = getServiceClient();
  const now = new Date().toISOString();
  const { error } = await client.from("source_runs").insert({
    source_id: sourceId,
    status: "failed",
    attempt,
    started_at: now,
    finished_at: now,
    error: reason,
  });
  if (error) throw new Error(`failed-run sentinel insert failed: ${error.message}`);
}

// 1h: Vercel caps these routes at 300s, so any run still 'running' an hour
// later has crashed. The 1h buffer (vs the 300s cap) absorbs clock skew
// between Vercel and Postgres without false positives on legitimate slow
// runs. The sentinel-row path in writeFailedRunSentinel is belt-and-braces
// for the same failure: without it, a finishRun UPDATE failure would only
// surface to the streak guard once the running row aged past this floor.
const STALE_RUNNING_MS = 60 * 60 * 1000;

export async function recentFailureStreak(sourceId: string): Promise<number> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("source_runs")
    .select("status, started_at")
    .eq("source_id", sourceId)
    .order("started_at", { ascending: false })
    .limit(3);
  if (error) throw new Error(`recent-runs lookup failed: ${error.message}`);
  const now = Date.now();
  let streak = 0;
  for (const row of (data ?? []) as Array<{ status: string; started_at: string }>) {
    if (row.status === "failed") {
      streak++;
      continue;
    }
    // Treat a stuck 'running' row as a failure so a crash that never reached
    // finishRun doesn't hide preceding failures from the auto-disable guard.
    if (row.status === "running") {
      const started = Date.parse(row.started_at);
      if (Number.isFinite(started) && now - started > STALE_RUNNING_MS) {
        streak++;
        continue;
      }
    }
    break;
  }
  return streak;
}

export type { DbListing };
