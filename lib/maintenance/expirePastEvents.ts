import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { isPastSpecificDateCard } from "@/lib/listings/isPast";

export interface ExpireOptions {
  apply: boolean;
  limit?: number;
  log?: (msg: string) => void;
}

export interface ExpireResult {
  cutoff: string;
  found: number;
  /** Rows newly flagged is_past on this run. */
  flagged: number;
  rows: Array<{ id: string; title: string; type: string; date_start: string | null; date_end: string | null }>;
}

interface Row {
  id: string;
  slug: string;
  title: string;
  type: string;
  date_start: string | null;
  date_end: string | null;
  date_display: string | null;
}

const ROW_COLUMNS = "id, slug, title, type, date_start, date_end, date_display";

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
  // Rows with both null are perpetual deals — skip them. Already-flagged rows
  // are skipped so the run is idempotent.
  let q = c
    .from("listings")
    .select(ROW_COLUMNS)
    .eq("is_past", false)
    .or(
      `date_end.lt.${cutoff},and(date_end.is.null,date_start.lt.${cutoff})`,
    );
  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw new Error(`query failed: ${error.message}`);
  const rows = (data ?? []) as Row[];

  // Second band: rows still inside the feed window on their date_end (a recurring
  // deal's rolling future end) but whose date_display names a specific PAST day
  // ("Thu, Jul 2"). The date-only query above can't see these — their date_end is
  // in the future. Refine in JS with the same predicate the feed uses.
  let bandQ = c
    .from("listings")
    .select(ROW_COLUMNS)
    .eq("is_past", false)
    .lt("date_start", cutoff)
    .gte("date_end", cutoff);
  if (opts.limit) bandQ = bandQ.limit(opts.limit);
  const { data: bandData, error: bandErr } = await bandQ;
  if (bandErr) throw new Error(`band query failed: ${bandErr.message}`);
  const byId = new Map<string, Row>();
  for (const r of rows) byId.set(r.id, r);
  for (const r of (bandData ?? []) as Row[]) {
    if (byId.has(r.id)) continue;
    if (isPastSpecificDateCard({ dateDisplay: r.date_display ?? "", startAt: r.date_start ?? "" })) {
      byId.set(r.id, r);
    }
  }
  const allRows = [...byId.values()];

  log(`[expire-past-events] cutoff=${cutoff} found=${allRows.length} apply=${opts.apply}`);
  for (const r of allRows.slice(0, 20)) {
    log(`  ${r.type.padEnd(5)} end=${r.date_end ?? r.date_start ?? "?"}  ${r.title}`);
  }
  if (allRows.length > 20) log(`  …and ${allRows.length - 20} more`);

  let flagged = 0;
  if (opts.apply && allRows.length > 0) {
    // Soft-flag, don't delete. The row + its image are kept so a user's
    // previously-saved event still resolves on its detail page and can power
    // the Past Saved tab / venue archives. The main feed already hides these
    // via its date cutoff + past-specific-date filter.
    const { error: updErr } = await c
      .from("listings")
      .update({ is_past: true })
      .in("id", allRows.map((r) => r.id));
    if (updErr) throw new Error(`flag failed: ${updErr.message}`);
    flagged = allRows.length;
    log(`[expire-past-events] flagged ${flagged} rows is_past`);
  }

  return { cutoff, found: allRows.length, flagged, rows: allRows };
}
