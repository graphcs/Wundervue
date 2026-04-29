export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  shouldRetry?: (err: unknown) => boolean;
}

export class RetryableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RetryableError";
  }
}

// 5xx is retryable; word-boundary anchors stop us from matching "status 5"
// inside arbitrary error strings (e.g. "5 retries left" or "status 500abc").
const RETRYABLE_5XX = /\bstatus 5\d{2}\b/;

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  attempts: 3,
  baseDelayMs: 500,
  shouldRetry: (err) => {
    if (err instanceof RetryableError) return true;
    if (err instanceof Error) {
      // Transient network conditions: timeouts, reset connections, and the
      // generic "fetch failed" undici wraps around several recoverable cases.
      // ENOTFOUND is permanent (DNS has no record) so we don't retry it —
      // hammering a dead hostname wastes attempts and may trigger rate limits
      // when it eventually does resolve.
      const msg = err.message.toLowerCase();
      return (
        msg.includes("etimedout") ||
        msg.includes("econnreset") ||
        msg.includes("eai_again") ||
        msg.includes("fetch failed") ||
        RETRYABLE_5XX.test(msg)
      );
    }
    return false;
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { attempts, baseDelayMs, shouldRetry } = { ...DEFAULT_OPTIONS, ...options };
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !shouldRetry(err)) {
        throw err;
      }
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
