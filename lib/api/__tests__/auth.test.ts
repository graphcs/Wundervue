import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { authorizeCronRequest } from "../auth";

function mockRequest(headers: Record<string, string>): NextRequest {
  const lowered = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    headers: { get: (key: string) => lowered[key.toLowerCase()] ?? null },
  } as unknown as NextRequest;
}

describe("authorizeCronRequest", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret-value";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("rejects when CRON_SECRET env is unset", () => {
    delete process.env.CRON_SECRET;
    expect(
      authorizeCronRequest(mockRequest({ authorization: "Bearer test-secret-value" })),
    ).toBe(false);
  });

  it("rejects when the authorization header is missing", () => {
    expect(authorizeCronRequest(mockRequest({}))).toBe(false);
  });

  it("rejects when the bearer prefix is correct but the secret is wrong", () => {
    expect(
      authorizeCronRequest(mockRequest({ authorization: "Bearer wrong-secret-value" })),
    ).toBe(false);
  });

  it("rejects when the secret length differs (no length-leak via timing)", () => {
    expect(
      authorizeCronRequest(mockRequest({ authorization: "Bearer short" })),
    ).toBe(false);
  });

  it("rejects when the prefix is missing", () => {
    expect(
      authorizeCronRequest(mockRequest({ authorization: "test-secret-value" })),
    ).toBe(false);
  });

  it("accepts when the bearer header matches the configured secret", () => {
    expect(
      authorizeCronRequest(mockRequest({ authorization: "Bearer test-secret-value" })),
    ).toBe(true);
  });
});
