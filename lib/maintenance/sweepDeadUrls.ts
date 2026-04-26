import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { checkUrl, type CheckUrlResult } from "@/lib/ingest/checkUrl";

export interface SweepOptions {
  apply: boolean;
  limit?: number;
  concurrency?: number;
  log?: (msg: string) => void;
}

export interface SweepResult {
  scanned: number;
  alive: number;
  dead: number;
  unknown: number;
  unpublished: number;
  deadRows: Array<{ id: string; title: string; url: string; httpStatus?: number; reason?: string }>;
}

interface Row {
  id: string;
  title: string;
  source: string;
  source_url: string;
}

function client(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

export async function sweepDeadUrls(opts: SweepOptions): Promise<SweepResult> {
  const log = opts.log ?? (() => {});
  const concurrency = opts.concurrency ?? 8;
  const c = client();

  let q = c
    .from("listings")
    .select("id, title, source, source_url")
    .not("source_url", "is", null)
    .not("published_at", "is", null);
  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw new Error(`query failed: ${error.message}`);
  const rows = (data ?? []) as Row[];

  log(`[sweep-dead-urls] scanning ${rows.length} rows, concurrency=${concurrency}, apply=${opts.apply}`);

  const dead: SweepResult["deadRows"] = [];
  let alive = 0;
  let unknown = 0;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
      while (cursor < rows.length) {
        const idx = cursor++;
        const row = rows[idx];
        const result: CheckUrlResult = await checkUrl(row.source_url);
        if (result.status === "dead") {
          dead.push({
            id: row.id,
            title: row.title,
            url: row.source_url,
            httpStatus: result.httpStatus,
            reason: result.reason,
          });
          log(`  DEAD [${result.httpStatus ?? result.reason}] ${row.title} ${row.source_url}`);
        } else if (result.status === "alive") {
          alive++;
        } else {
          unknown++;
        }
      }
    }),
  );

  let unpublished = 0;
  if (opts.apply && dead.length > 0) {
    const { error: updErr } = await c
      .from("listings")
      .update({ published_at: null })
      .in("id", dead.map((d) => d.id));
    if (updErr) throw new Error(`unpublish failed: ${updErr.message}`);
    unpublished = dead.length;
    log(`[sweep-dead-urls] unpublished ${unpublished} rows`);
  }

  return {
    scanned: rows.length,
    alive,
    dead: dead.length,
    unknown,
    unpublished,
    deadRows: dead,
  };
}
