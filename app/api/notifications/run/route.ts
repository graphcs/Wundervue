import type { NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/api/auth";
import {
  runMonthlyFavorites,
  runNewDrops,
  runVenueAlerts,
  runWeeklyRecs,
  type JobResult,
} from "@/lib/notify/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

const JOBS = ["monthly-favorites", "new-drops", "venue-alerts", "weekly-recs"] as const;
type Job = (typeof JOBS)[number];

function isJob(value: string | null): value is Job {
  return value !== null && (JOBS as readonly string[]).includes(value);
}

async function runJob(job: Job, now: Date): Promise<JobResult> {
  switch (job) {
    case "monthly-favorites":
      return runMonthlyFavorites(now);
    case "new-drops":
      return runNewDrops(now);
    case "venue-alerts":
      return runVenueAlerts(now);
    case "weekly-recs":
      return runWeeklyRecs(now);
  }
}

async function handle(request: NextRequest): Promise<Response> {
  if (!authorizeCronRequest(request)) {
    return new Response("unauthorized", { status: 401 });
  }
  const job = request.nextUrl.searchParams.get("job");
  if (!isJob(job)) {
    return new Response(`invalid job: ${job}`, { status: 400 });
  }
  try {
    const result = await runJob(job, new Date());
    return Response.json(result);
  } catch (err) {
    console.error(`[notifications:${job}] failed`, err);
    return new Response(`job failed: ${job}`, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
