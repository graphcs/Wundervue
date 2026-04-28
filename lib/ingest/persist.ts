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
  const sourcePairs = rows.map((r) => ({ source: r.source, source_id: r.source_id }));
  const { data: existingSame, error: e1 } = await client
    .from("listings")
    .select("id, source, source_id, event_key")
    .in(
      "source_id",
      sourcePairs.map((p) => p.source_id),
    );
  if (e1) throw new Error(`existing-same lookup failed: ${e1.message}`);

  const sameMap = new Map<string, ExistingRow>();
  for (const row of (existingSame ?? []) as ExistingRow[]) {
    sameMap.set(`${row.source}|${row.source_id}`, row);
  }

  // Cross-source lookup: rows with matching event_key from a different source.
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
    if (crossMatch && crossMatch.source !== row.source) {
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

  const toUpsert = actions.map((a) => a.row);
  const { error } = await client
    .from("listings")
    .upsert(toUpsert, { onConflict: "source,source_id" });
  if (error) throw new Error(`upsert failed: ${error.message}`);

  let inserted = 0;
  let updated = 0;
  let duplicate = 0;
  for (const a of actions) {
    if (a.kind === "insert") inserted++;
    else if (a.kind === "update") updated++;
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

export async function recentFailureStreak(sourceId: string): Promise<number> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("source_runs")
    .select("status")
    .eq("source_id", sourceId)
    .order("started_at", { ascending: false })
    .limit(3);
  if (error) throw new Error(`recent-runs lookup failed: ${error.message}`);
  let streak = 0;
  for (const row of (data ?? []) as Array<{ status: string }>) {
    if (row.status === "failed") streak++;
    else break;
  }
  return streak;
}

export type { DbListing };
