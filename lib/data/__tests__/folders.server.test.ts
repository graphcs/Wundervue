import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A tiny mock of the supabase-js client: `.from(table)` returns a chainable
// builder; `.maybeSingle()` yields the table's configured single row and
// awaiting the builder yields its configured rows.
const h = vi.hoisted(() => {
  const state: { tables: Record<string, { single?: unknown; rows?: unknown[] }> } = {
    tables: {},
  };
  function makeBuilder(table: string) {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "not", "order", "limit"]) b[m] = () => b;
    b.maybeSingle = () =>
      Promise.resolve({ data: state.tables[table]?.single ?? null, error: null });
    b.single = b.maybeSingle;
    b.then = (onF: (v: unknown) => unknown) =>
      Promise.resolve({ data: state.tables[table]?.rows ?? [], error: null }).then(onF);
    return b;
  }
  return { state, makeBuilder };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/env", () => ({ SUPABASE_URL: "http://test" }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (t: string) => h.makeBuilder(t) }),
}));

import { getSharedFolder, getSharedSaves } from "../folders.server";

const listingRow = {
  id: "l1", slug: "an-event", type: "event", title: "An Event", description: "",
  venue_id: "v1", address: "", neighborhood: "RiNo", category: "Music",
  date_start: "2026-07-01T00:00:00Z", date_end: null, date_display: "", time_display: "",
  is_free: false, deal_value: null, image_url: "", source: "Website", source_url: null, tags: [],
};

beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
  h.state.tables = {};
});
afterEach(() => vi.unstubAllEnvs());

describe("getSharedSaves", () => {
  it("returns null for an empty slug", async () => {
    expect(await getSharedSaves("")).toBeNull();
  });

  it("returns null without a service-role key", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await getSharedSaves("abc")).toBeNull();
  });

  it("returns null when the slug resolves to no profile", async () => {
    h.state.tables = { profiles: { single: null } };
    expect(await getSharedSaves("missing")).toBeNull();
  });

  it("resolves a profile slug to its saved listings", async () => {
    h.state.tables = {
      profiles: { single: { user_id: "u1", name: "Tess" } },
      favorites: { rows: [{ listing_id: "l1" }] },
      listings: { rows: [listingRow] },
      venues: { rows: [{ id: "v1", name: "Mission Ballroom" }] },
    };
    const shared = await getSharedSaves("good-slug");
    expect(shared).not.toBeNull();
    expect(shared!.name).toBe("Tess's saves");
    expect(shared!.listings).toHaveLength(1);
    expect(shared!.listings[0].title).toBe("An Event");
    expect(shared!.listings[0].venueName).toBe("Mission Ballroom");
  });

  it("returns an empty collection when the user has no favorites", async () => {
    h.state.tables = {
      profiles: { single: { user_id: "u1", name: "Tess" } },
      favorites: { rows: [] },
    };
    const shared = await getSharedSaves("good-slug");
    expect(shared!.listings).toEqual([]);
  });
});

describe("getSharedFolder", () => {
  it("returns null for an unknown share slug", async () => {
    h.state.tables = { saved_folders: { single: null } };
    expect(await getSharedFolder("nope")).toBeNull();
  });

  it("resolves a folder slug to its listings", async () => {
    h.state.tables = {
      // Membership now lives in folder_items, not favorites.folder_id.
      saved_folders: { single: { id: "f1", user_id: "u1", name: "Weekend", kind: "basic" } },
      folder_items: { rows: [{ listing_id: "l1" }] },
      listings: { rows: [listingRow] },
      venues: { rows: [{ id: "v1", name: "Mission Ballroom" }] },
    };
    const folder = await getSharedFolder("good-slug");
    expect(folder!.name).toBe("Weekend");
    expect(folder!.ownerId).toBe("u1");
    expect(folder!.listings).toHaveLength(1);
    expect(folder!.listings[0].venueName).toBe("Mission Ballroom");
  });
});
