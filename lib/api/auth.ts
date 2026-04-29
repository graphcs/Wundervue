import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

// Constant-time bearer-token check for cron-triggered routes (ingest, tier
// batch, maintenance). Plain `===` short-circuits on the first byte mismatch,
// which is a timing oracle for shared-secret comparison; timingSafeEqual
// requires equal-length buffers and reads every byte before returning.
//
// Returns false (not throws) for missing env, missing header, or length
// mismatch — callers map false to 401.
export function authorizeCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (!header) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
