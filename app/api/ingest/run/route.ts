import type { NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/api/auth";
import { ingestSource } from "@/lib/ingest/orchestrator";
import { getSource } from "@/lib/ingest/sources";
import { revalidateFeedCache } from "@/lib/data/feedCache";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handle(request: NextRequest): Promise<Response> {
  if (!authorizeCronRequest(request)) {
    return new Response("unauthorized", { status: 401 });
  }
  const sourceId = request.nextUrl.searchParams.get("source");
  if (!sourceId) {
    return new Response("missing source", { status: 400 });
  }
  const source = getSource(sourceId);
  if (!source) {
    return new Response(`unknown source: ${sourceId}`, { status: 404 });
  }
  const result = await ingestSource(source);
  // Drop the cached feed so this source's new events surface immediately.
  if (result.status !== "failed") revalidateFeedCache();
  const status = result.status === "failed" ? 500 : 200;
  return Response.json(result, { status });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
