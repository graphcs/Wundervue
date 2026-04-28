import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchProfileForUser } from "../supabaseAuthRepo";

type MaybeSingleResult = { data: unknown; error: unknown };

function makeClient(result: MaybeSingleResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as ReturnType<typeof getSupabaseBrowserClient>;
}

describe("fetchProfileForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps the row to a Profile when present", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(
      makeClient({
        data: {
          user_id: "u1",
          name: "Daisy",
          plan: "free",
          interests: ["music"],
          neighborhoods: null,
          lifestyle: null,
          created_at: "2026-01-01T00:00:00Z",
        },
        error: null,
      }),
    );

    await expect(
      fetchProfileForUser("u1", "daisy@example.com"),
    ).resolves.toEqual({
      userId: "u1",
      name: "Daisy",
      email: "daisy@example.com",
      plan: "free",
      interests: ["music"],
      neighborhoods: [],
      lifestyle: [],
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  it("returns null when the profile row genuinely doesn't exist", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(
      makeClient({ data: null, error: null }),
    );

    await expect(fetchProfileForUser("u1", null)).resolves.toBeNull();
  });

  it("throws on query errors so callers can preserve an existing profile", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(
      makeClient({ data: null, error: { message: "network down" } }),
    );

    await expect(fetchProfileForUser("u1", null)).rejects.toThrow(
      "network down",
    );
  });
});
