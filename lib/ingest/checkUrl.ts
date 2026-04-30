/**
 * URL liveness check used both at ingest time and by the sweeper.
 *
 * "dead" means the server returned a definitive client-error status that
 * tells us the page is gone (404, 410) or otherwise unreachable in a way
 * a normal user's browser would also fail (DNS failure). Network glitches,
 * timeouts, and 5xx are "unknown" — we don't unpublish on those because
 * the next check might succeed.
 */

export type UrlStatus = "alive" | "dead" | "unknown";

export interface CheckUrlResult {
  status: UrlStatus;
  httpStatus?: number;
  reason?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
// Some sites (Squarespace, a few WordPress hosts) return 405 for HEAD or
// serve different bodies. Fall back to GET when HEAD looks suspicious.
const HEAD_FALLBACK_STATUSES = new Set([403, 405, 501]);
// Anything in this set is treated as "this page is gone", not a transient
// problem. 401/403 deliberately excluded — they're access control, not absence.
const DEAD_STATUSES = new Set([404, 410]);

const USER_AGENT =
  "Mozilla/5.0 (compatible; WundervueLinkChecker/1.0; +https://wundervue.com)";

async function tryFetch(
  url: string,
  method: "HEAD" | "GET",
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkUrl(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<CheckUrlResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: "dead", reason: "invalid url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { status: "dead", reason: `unsupported protocol ${parsed.protocol}` };
  }

  try {
    const head = await tryFetch(url, "HEAD", timeoutMs);
    if (DEAD_STATUSES.has(head.status)) {
      return { status: "dead", httpStatus: head.status };
    }
    if (head.ok) {
      return { status: "alive", httpStatus: head.status };
    }
    if (!HEAD_FALLBACK_STATUSES.has(head.status) && head.status < 500) {
      // Definite non-OK that isn't a known HEAD-quirk: trust it.
      return { status: "alive", httpStatus: head.status };
    }
    // HEAD inconclusive — try GET.
    const get = await tryFetch(url, "GET", timeoutMs);
    if (DEAD_STATUSES.has(get.status)) {
      return { status: "dead", httpStatus: get.status };
    }
    if (get.ok) return { status: "alive", httpStatus: get.status };
    return { status: "unknown", httpStatus: get.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Node wraps low-level errors as `TypeError: fetch failed` and stashes
    // the original on `.cause`. ENOTFOUND = the domain itself is gone.
    const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
    const code = (cause as { code?: string } | undefined)?.code;
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      return { status: "dead", reason: `${code}: ${msg}` };
    }
    return { status: "unknown", reason: msg };
  }
}
