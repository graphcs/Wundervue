import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchProfileForUser, supabaseAuthRepo } from "../supabaseAuthRepo";

type MaybeSingleResult = { data: unknown; error: unknown };

function makeClient(result: MaybeSingleResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as ReturnType<typeof getSupabaseBrowserClient>;
}

interface FullClientOptions {
  // Sequential profile-row results returned from .maybeSingle() across retries.
  profileResults: MaybeSingleResult[];
  // The user record returned by auth.getUser().
  user?: { id: string; email: string | null } | null;
  // The session record returned by auth.signInWithPassword / signUp.
  session?: { user: { id: string; email: string | null } } | null;
  // Optional spy hooks injected so tests can assert on side effects.
  signOut?: ReturnType<typeof vi.fn>;
  signInWithPassword?: ReturnType<typeof vi.fn>;
  signUp?: ReturnType<typeof vi.fn>;
}

function makeFullClient(opts: FullClientOptions) {
  const profileResults = [...opts.profileResults];
  const maybeSingle = vi.fn().mockImplementation(async () => {
    return profileResults.length > 0
      ? profileResults.shift()!
      : { data: null, error: null };
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  const getUser = vi.fn().mockResolvedValue({
    data: { user: opts.user ?? null },
    error: opts.user ? null : { message: "no user" },
  });
  const signOut = opts.signOut ?? vi.fn().mockResolvedValue({ error: null });
  const signInWithPassword =
    opts.signInWithPassword ??
    vi.fn().mockResolvedValue({
      data: { session: opts.session ?? null },
      error: opts.session ? null : { message: "bad credentials" },
    });
  const signUp =
    opts.signUp ??
    vi.fn().mockResolvedValue({
      data: { session: opts.session ?? null },
      error: null,
    });

  const client = {
    from,
    auth: { getUser, signOut, signInWithPassword, signUp },
  } as unknown as ReturnType<typeof getSupabaseBrowserClient>;

  return { client, signOut, signInWithPassword, signUp };
}

const PROFILE_ROW = {
  user_id: "u1",
  name: "Daisy",
  plan: "free",
  interests: ["music"],
  neighborhoods: null,
  lifestyle: null,
  created_at: "2026-01-01T00:00:00Z",
};

describe("fetchProfileForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps the row to a Profile when present", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(
      makeClient({ data: PROFILE_ROW, error: null }),
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

describe("signIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("returns mapped session and profile on the happy path", async () => {
    const { client } = makeFullClient({
      profileResults: [{ data: PROFILE_ROW, error: null }],
      user: { id: "u1", email: "daisy@example.com" },
      session: { user: { id: "u1", email: "daisy@example.com" } },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client);

    const result = await supabaseAuthRepo.signIn({
      email: "daisy@example.com",
      password: "secret",
    });

    expect(result.session).toEqual({ userId: "u1", email: "daisy@example.com" });
    expect(result.profile.name).toBe("Daisy");
  });

  it("rolls back via signOut and surfaces a user-friendly error when the profile never appears", async () => {
    vi.useFakeTimers();
    const signOut = vi.fn().mockResolvedValue({ error: null });
    // 10 attempts, all returning a missing row — exhausts the retry budget.
    const profileResults = Array.from({ length: 10 }, () => ({
      data: null,
      error: null,
    }));
    const { client } = makeFullClient({
      profileResults,
      user: { id: "u1", email: "daisy@example.com" },
      session: { user: { id: "u1", email: "daisy@example.com" } },
      signOut,
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client);

    const promise = supabaseAuthRepo.signIn({
      email: "daisy@example.com",
      password: "secret",
    });
    // Attach the rejection handler before draining timers so the rejection
    // doesn't surface as an unhandled promise rejection in the runner.
    const settled = expect(promise).rejects.toThrow(
      /couldn't finish setting up your account/i,
    );
    await vi.runAllTimersAsync();
    await settled;
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("propagates auth errors without calling signOut", async () => {
    const signOut = vi.fn();
    const { client } = makeFullClient({
      profileResults: [],
      user: null,
      session: null,
      signOut,
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client);

    await expect(
      supabaseAuthRepo.signIn({ email: "x@y.z", password: "nope" }),
    ).rejects.toThrow("bad credentials");
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("signUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("returns the session and profile when Supabase issues a session immediately", async () => {
    const { client } = makeFullClient({
      profileResults: [{ data: PROFILE_ROW, error: null }],
      user: { id: "u1", email: "daisy@example.com" },
      session: { user: { id: "u1", email: "daisy@example.com" } },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client);

    const result = await supabaseAuthRepo.signUp({
      name: "Daisy",
      email: "daisy@example.com",
      password: "secret",
    });

    expect("pendingConfirmation" in result).toBe(false);
    if ("pendingConfirmation" in result) return;
    expect(result.session.userId).toBe("u1");
    expect(result.profile.name).toBe("Daisy");
  });

  it("returns pendingConfirmation when Supabase requires email verification", async () => {
    const signUp = vi
      .fn()
      .mockResolvedValue({ data: { session: null }, error: null });
    const { client } = makeFullClient({
      profileResults: [],
      user: null,
      session: null,
      signUp,
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client);

    const result = await supabaseAuthRepo.signUp({
      name: "Daisy",
      email: "daisy@example.com",
      password: "secret",
    });

    expect(result).toEqual({
      pendingConfirmation: true,
      email: "daisy@example.com",
    });
  });
});
