import type { NextRequest } from "next/server";
import { sweepDeadUrls } from "@/lib/maintenance/sweepDeadUrls";
import { expirePastEvents } from "@/lib/maintenance/expirePastEvents";

export const runtime = "nodejs";
export const maxDuration = 300;

const VALID_TASKS = ["sweep-urls", "expire-past"] as const;
type Task = (typeof VALID_TASKS)[number];

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function isTask(value: string | null): value is Task {
  return value !== null && (VALID_TASKS as readonly string[]).includes(value);
}

async function handle(request: NextRequest): Promise<Response> {
  if (!authorized(request)) {
    return new Response("unauthorized", { status: 401 });
  }
  const task = request.nextUrl.searchParams.get("task");
  if (!isTask(task)) {
    return new Response(`invalid task: ${task}`, { status: 400 });
  }
  // dry=1 short-circuits the write step. Useful for sanity checks via curl.
  const apply = request.nextUrl.searchParams.get("dry") !== "1";

  if (task === "sweep-urls") {
    const result = await sweepDeadUrls({ apply, log: (m) => console.log(m) });
    return Response.json({ task, apply, ...result });
  }
  const result = await expirePastEvents({ apply, log: (m) => console.log(m) });
  return Response.json({ task, apply, ...result });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
