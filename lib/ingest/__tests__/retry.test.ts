import { describe, expect, it } from "vitest";
import { withRetry, RetryableError } from "../retry";

function makeFlaky(errors: unknown[], finalValue: string) {
  let i = 0;
  return async () => {
    if (i < errors.length) throw errors[i++];
    return finalValue;
  };
}

describe("withRetry classifier", () => {
  it("retries explicit RetryableError", async () => {
    const fn = makeFlaky([new RetryableError("transient")], "ok");
    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(result).toBe("ok");
  });

  it("retries ETIMEDOUT and ECONNRESET", async () => {
    const fn = makeFlaky(
      [new Error("connect ETIMEDOUT 1.2.3.4:443"), new Error("ECONNRESET reading body")],
      "ok",
    );
    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(result).toBe("ok");
  });

  it("retries 5xx via word-boundary regex", async () => {
    const fn = makeFlaky([new Error("apify run failed: status 503")], "ok");
    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(result).toBe("ok");
  });

  it("does NOT retry strings that contain 'status 5' as substring without 5xx pattern", async () => {
    // "5 retries" contains "status 5" but is not a 5xx — the old substring
    // matcher would retry; the regex must not.
    const err = new Error("auth failed: status 5 retries left");
    let calls = 0;
    const fn = async () => {
      calls++;
      throw err;
    };
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("does NOT retry ENOTFOUND (permanent DNS failure)", async () => {
    const err = new Error("getaddrinfo ENOTFOUND missing.example.com");
    let calls = 0;
    const fn = async () => {
      calls++;
      throw err;
    };
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("retries EAI_AGAIN (transient DNS failure)", async () => {
    const fn = makeFlaky([new Error("getaddrinfo EAI_AGAIN api.example.com")], "ok");
    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(result).toBe("ok");
  });

  it("does NOT retry 4xx errors", async () => {
    const err = new Error("serpapi failed: status 401");
    let calls = 0;
    const fn = async () => {
      calls++;
      throw err;
    };
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("stops after max attempts on persistently retryable errors", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new RetryableError("flaky");
    };
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1 })).rejects.toThrow();
    expect(calls).toBe(3);
  });
});
