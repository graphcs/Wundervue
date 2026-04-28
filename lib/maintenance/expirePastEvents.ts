import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { deleteListingImagesBySlug } from "@/lib/ingest/uploadImage";

export interface ExpireOptions {
  apply: boolean;
  limit?: number;
  log?: (msg: string) => void;
}

export interface ExpireResult {
  cutoff: string;
  found: number;
  deleted: number;
  imagesDeleted: number;
  rows: Array<{ id: string; title: string; type: string; date_start: string | null; date_end: string | null }>;
}

interface Row {
  id: string;
  slug: string;
  title: string;
  type: string;
  date_start: string | null;
  date_end: string | null;
}

function client(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

// Cutoff = start of today UTC. Events ending strictly before this are past.
// We do not use local time: comparing dated DB values to "midnight UTC today"
// gives a small grace window for late-evening events in US timezones, which
// is preferable to deleting an event the same day it ends.
function startOfTodayUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function expirePastEvents(opts: ExpireOptions): Promise<ExpireResult> {
  const log = opts.log ?? (() => {});
  const cutoff = startOfTodayUtcIso();
  const c = client();

  // Effective end date is COALESCE(date_end, date_start). We match either
  // (date_end < cutoff) OR (date_end IS NULL AND date_start < cutoff).
  // Rows with both null are perpetual deals — skip them.
  let q = c
    .from("listings")
    .select("id, slug, title, type, date_start, date_end")
    .or(
      `date_end.lt.${cutoff},and(date_end.is.null,date_start.lt.${cutoff})`,
    );
  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw new Error(`query failed: ${error.message}`);
  const rows = (data ?? []) as Row[];

  log(`[expire-past-events] cutoff=${cutoff} found=${rows.length} apply=${opts.apply}`);
  for (const r of rows.slice(0, 20)) {
    log(`  ${r.type.padEnd(5)} end=${r.date_end ?? r.date_start ?? "?"}  ${r.title}`);
  }
  if (rows.length > 20) log(`  …and ${rows.length - 20} more`);

  let deleted = 0;
  let imagesDeleted = 0;
  if (opts.apply && rows.length > 0) {
    // Drop storage objects first — if it fails we still want to free the row.
    // A leaked storage object is cheaper than a stuck table row, and the bucket
    // can be swept periodically with a separate maintenance job if needed.
    try {
      imagesDeleted = await deleteListingImagesBySlug(rows.map((r) => r.slug));
    } catch (err) {
      log(`[expire-past-events] storage cleanup failed (continuing): ${err instanceof Error ? err.message : String(err)}`);
    }

    const { error: delErr } = await c
      .from("listings")
      .delete()
      .in("id", rows.map((r) => r.id));
    if (delErr) throw new Error(`delete failed: ${delErr.message}`);
    deleted = rows.length;
    log(`[expire-past-events] deleted ${deleted} rows, ${imagesDeleted} storage objects`);
  }

  return { cutoff, found: rows.length, deleted, imagesDeleted, rows };
}
