import type { NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/api/auth";
import { ingestSource } from "@/lib/ingest/orchestrator";
import { getEnabledSources } from "@/lib/ingest/sources";
import type { Cadence, IngestResult } from "@/lib/ingest/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const VALID_TIERS: Cadence[] = ["hourly", "daily", "weekly"];
const CONCURRENCY = 2;

function isCadence(value: string | null): value is Cadence {
  return value !== null && (VALID_TIERS as string[]).includes(value);
}

// Parse optional `shards`/`shard` query params for splitting one cadence across
// multiple cron invocations (so a large tier stays under the function timeout).
// Returns null on malformed input so the caller can 400. Absent params mean
// "run the whole tier" → { shards: 1, shard: 0 }.
function parseShard(
  params: URLSearchParams,
): { shards: number; shard: number } | null {
  const shardsRaw = params.get("shards");
  const shardRaw = params.get("shard");
  if (shardsRaw === null && shardRaw === null) {
    return { shards: 1, shard: 0 };
  }
  const shards = Number(shardsRaw);
  const shard = Number(shardRaw);
  if (
    !Number.isInteger(shards) ||
    !Number.isInteger(shard) ||
    shards < 1 ||
    shard < 0 ||
    shard >= shards
  ) {
    return null;
  }
  return { shards, shard };
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function next(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

async function handle(request: NextRequest): Promise<Response> {
  if (!authorizeCronRequest(request)) {
    return new Response("unauthorized", { status: 401 });
  }
  const tier = request.nextUrl.searchParams.get("tier");
  if (!isCadence(tier)) {
    return new Response(`invalid tier: ${tier}`, { status: 400 });
  }
  const sharding = parseShard(request.nextUrl.searchParams);
  if (!sharding) {
    return new Response("invalid shard/shards", { status: 400 });
  }
  const { shards, shard } = sharding;
  // Partition deterministically by index so the union of shard=0..shards-1
  // covers every source exactly once with no overlap. shards=1 → all sources.
  const sources = getEnabledSources(tier).filter((_s, i) => i % shards === shard);
  const results: IngestResult[] = await runWithConcurrency(
    sources,
    (s) => ingestSource(s),
    CONCURRENCY,
  );
  // Vercel Cron only alerts on non-2xx. Total-failure batches must surface as
  // 5xx or every source going down looks like a healthy run. Single-source
  // failures stay 200 so a transient SerpAPI 503 doesn't page on-call.
  const allFailed = results.length > 0 && results.every((r) => r.status === "failed");
  const status = allFailed ? 500 : 200;
  return Response.json(
    { tier, shard, shards, count: results.length, results },
    { status },
  );
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
