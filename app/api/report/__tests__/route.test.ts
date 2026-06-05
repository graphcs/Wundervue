import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, insert } = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue({ auth: { getUser } }),
}));
vi.mock("@/lib/stripe/admin", () => ({
  getSupabaseAdmin: () => ({ from: () => ({ insert }) }),
}));

import { POST } from "../route";

function makeRequest(body: unknown): Request {
  return new Request("https://app.example.com/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    insert.mockResolvedValue({ error: null });
  });

  it("400 when listingId is missing", async () => {
    const res = await POST(makeRequest({ issueType: "wrong-datetime" }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("400 when issueType is not in the allowed set", async () => {
    const res = await POST(makeRequest({ listingId: "abc", issueType: "nonsense" }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("400 on invalid JSON body", async () => {
    const bad = new Request("https://app.example.com/api/report", {
      method: "POST",
      body: "{not json",
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
  });

  it("inserts and returns 201 for a valid report, attaching the user id", async () => {
    const res = await POST(
      makeRequest({ listingId: "abc", issueType: "wrong-price", note: "off by $5", email: "a@b.co" }),
    );
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({
      listing_id: "abc",
      issue_type: "wrong-price",
      note: "off by $5",
      email: "a@b.co",
      user_id: "user-1",
    });
  });

  it("maps a FK violation (unknown listing) to 400", async () => {
    insert.mockResolvedValue({ error: { code: "23503", message: "fk" } });
    const res = await POST(makeRequest({ listingId: "ghost", issueType: "other" }));
    expect(res.status).toBe(400);
  });
});
