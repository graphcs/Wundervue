import type { NextRequest } from "next/server";
import { ingestSource } from "@/lib/ingest/orchestrator";
import { getEnabledSources } from "@/lib/ingest/sources";
import type { Cadence, IngestResult } from "@/lib/ingest/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const VALID_TIERS: Cadence[] = ["hourly", "daily", "weekly"];
const CONCURRENCY = 2;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function isCadence(value: string | null): value is Cadence {
  return value !== null && (VALID_TIERS as string[]).includes(value);
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
  if (!authorized(request)) {
    return new Response("unauthorized", { status: 401 });
  }
  const tier = request.nextUrl.searchParams.get("tier");
  if (!isCadence(tier)) {
    return new Response(`invalid tier: ${tier}`, { status: 400 });
  }
  const sources = getEnabledSources(tier);
  const results: IngestResult[] = await runWithConcurrency(
    sources,
    (s) => ingestSource(s),
    CONCURRENCY,
  );
  return Response.json({ tier, count: results.length, results });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
