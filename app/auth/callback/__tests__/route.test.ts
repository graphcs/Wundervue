import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession },
  }),
}));

import { GET } from "../route";

function makeRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

describe("/auth/callback open-redirect protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("redirects to a path-relative `next` after a successful exchange", async () => {
    const res = await GET(
      makeRequest("https://app.example.com/auth/callback?code=abc&next=/explore"),
    );
    expect(res.headers.get("location")).toBe("https://app.example.com/explore");
  });

  it("rejects protocol-relative `next` (//evil.com) and falls back to `/`", async () => {
    const res = await GET(
      makeRequest(
        "https://app.example.com/auth/callback?code=abc&next=%2F%2Fevil.com%2Fphish",
      ),
    );
    expect(res.headers.get("location")).toBe("https://app.example.com/");
  });

  it("rejects absolute-URL `next` (https://evil.com) and falls back to `/`", async () => {
    const res = await GET(
      makeRequest(
        "https://app.example.com/auth/callback?code=abc&next=https%3A%2F%2Fevil.com%2Fphish",
      ),
    );
    expect(res.headers.get("location")).toBe("https://app.example.com/");
  });

  it("redirects to /?auth_error=1 when no `code` is present", async () => {
    const res = await GET(makeRequest("https://app.example.com/auth/callback"));
    expect(res.headers.get("location")).toBe(
      "https://app.example.com/?auth_error=1",
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects to /?auth_error=1 when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      error: { message: "invalid grant" },
    });
    const res = await GET(
      makeRequest("https://app.example.com/auth/callback?code=bad&next=/explore"),
    );
    expect(res.headers.get("location")).toBe(
      "https://app.example.com/?auth_error=1",
    );
  });
});
