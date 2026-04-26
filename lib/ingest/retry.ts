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

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  attempts: 3,
  baseDelayMs: 500,
  shouldRetry: (err) => {
    if (err instanceof RetryableError) return true;
    if (err instanceof Error) {
      // Network timeouts and Apify 5xx come through as fetch errors with these codes.
      const msg = err.message.toLowerCase();
      return (
        msg.includes("etimedout") ||
        msg.includes("econnreset") ||
        msg.includes("enotfound") ||
        msg.includes("fetch failed") ||
        msg.includes("status 5")
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
