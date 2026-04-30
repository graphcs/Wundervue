import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

// Constant-time bearer-token check for cron-triggered routes (ingest, tier
// batch, maintenance). Plain `===` short-circuits on the first byte mismatch,
// which is a timing oracle for shared-secret comparison; timingSafeEqual
// requires equal-length buffers and reads every byte before returning.
//
// Returns false (not throws) for missing env, missing header, or length
// mismatch — callers map false to 401.
//
// Contract for new cron routes:
//   1. Add the path under crons[] in vercel.json. Vercel auto-injects
//      `Authorization: Bearer ${CRON_SECRET}` on those dispatched requests.
//   2. The route handler MUST call this helper and return 401 when it
//      returns false. Forgetting either step makes the route publicly
//      callable on its public Vercel URL — the cron path is otherwise
//      unauthenticated. vercel.json is strict JSON and can't carry a
//      comment, so this docblock is the contract — see
//      __tests__/auth.test.ts for the negative-path assertions that guard
//      against forgetting either step.
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
