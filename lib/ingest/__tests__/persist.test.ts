import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListingInsert } from "../types";

// Mock @supabase/supabase-js so getServiceClient() in persist.ts gets our
// chainable stub instead of a real client. Each test configures a queue of
// `{ data, error }` responses; the stub's from() consumes one per call.

type QueryResponse = { data: unknown; error: unknown };

interface ClientHandle {
  client: { from: (table: string) => unknown };
  fromCalls: Array<{ table: string; calls: Array<{ method: string; args: unknown[] }> }>;
  setResponses: (next: QueryResponse[]) => void;
}

function makeClientHandle(): ClientHandle {
  let responses: QueryResponse[] = [];
  let i = 0;
  const fromCalls: ClientHandle["fromCalls"] = [];
  return {
    setResponses(next) {
      responses = next;
      i = 0;
      fromCalls.length = 0;
    },
    fromCalls,
    client: {
      from(table: string) {
        const calls: Array<{ method: string; args: unknown[] }> = [];
        fromCalls.push({ table, calls });
        const response = responses[i++] ?? { data: null, error: null };
        const builder: Record<string, unknown> = {};
        const chain = [
          "select",
          "insert",
          "update",
          "delete",
          "upsert",
          "eq",
          "in",
          "not",
          "is",
          "gte",
          "order",
          "limit",
          "single",
        ];
        for (const m of chain) {
          builder[m] = (...args: unknown[]) => {
            calls.push({ method: m, args });
            return builder;
          };
        }
        builder.then = (
          onFulfilled: (v: QueryResponse) => unknown,
          onRejected: (reason: unknown) => unknown,
        ) => Promise.resolve(response).then(onFulfilled, onRejected);
        return builder;
      },
    },
  };
}

const handle = makeClientHandle();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => handle.client),
}));

// classifyForUpsert reads ListingInsert.event_key but doesn't compute it; we
// can pass simple deterministic strings instead of the real sha256 hash.
function makeRow(overrides: Partial<ListingInsert> = {}): ListingInsert {
  return {
    slug: "test-event-abc123",
    type: "event",
    title: "Test Event",
    description: "",
    venue_id: null,
    address: null,
    neighborhood: null,
    region_slug: null,
    city_slug: null,
    neighborhood_slug: null,
    category: null,
    date_start: "2027-04-15T00:00:00.000Z",
    date_end: null,
    date_display: null,
    time_display: null,
    is_free: false,
    deal_value: null,
    image_url: "https://example.com/img.jpg",
    image_source: "scraped",
    tags: [],
    lat: null,
    lng: null,
    source: "Website",
    source_url: null,
    source_id: "test-id",
    event_key: "key-1",
    dedup_of: null,
    published_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  // Reset the persist module so its `cachedClient` is null again — otherwise
  // the first test's mock leaks into every subsequent test.
  vi.resetModules();
  handle.setResponses([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("classifyForUpsert", () => {
  it("returns [] without any DB calls when given an empty batch", async () => {
    const { classifyForUpsert } = await import("../persist");
    const result = await classifyForUpsert([]);
    expect(result).toEqual([]);
    expect(handle.fromCalls).toHaveLength(0);
  });

  it("classifies an exact (source, source_id) match as update", async () => {
    handle.setResponses([
      // existing-same lookup: the row already exists
      {
        data: [
          { id: "row-1", source: "Website", source_id: "abc", event_key: "key-1" },
        ],
        error: null,
      },
      // existing-by-key lookup: doesn't matter since sameMatch wins
      { data: [], error: null },
    ]);
    const { classifyForUpsert } = await import("../persist");
    const result = await classifyForUpsert([
      makeRow({ source: "Website", source_id: "abc", event_key: "key-1" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "update", existingId: "row-1" });
  });

  it("does NOT update when only source_id matches but source differs (regression: per-source filtering)", async () => {
    // The same-source query is filtered .eq("source", "Website"), so a row
    // with source="Instagram" sharing the source_id string is not returned.
    // No event_key match either → must be insert, not update.
    handle.setResponses([
      { data: [], error: null }, // existing-same: filtered out by .eq("source", "Website")
      { data: [], error: null }, // existing-by-key
    ]);
    const { classifyForUpsert } = await import("../persist");
    const result = await classifyForUpsert([
      makeRow({ source: "Website", source_id: "abc", event_key: "key-1" }),
    ]);
    expect(result[0].kind).toBe("insert");
    // Verify the .eq("source", ...) was actually issued.
    const sameLookup = handle.fromCalls[0];
    const eqCall = sameLookup.calls.find((c) => c.method === "eq");
    expect(eqCall).toBeDefined();
    expect(eqCall?.args).toEqual(["source", "Website"]);
  });

  it("classifies same event_key from a different source as skip-duplicate (cross-source)", async () => {
    handle.setResponses([
      { data: [], error: null }, // no same-source match
      {
        data: [
          {
            id: "canonical-1",
            source: "Instagram",
            source_id: "ig-shortcode",
            event_key: "key-1",
            published_at: "2027-04-01T00:00:00.000Z",
          },
        ],
        error: null,
      },
    ]);
    const { classifyForUpsert } = await import("../persist");
    const result = await classifyForUpsert([
      makeRow({ source: "Website", source_id: "different-id", event_key: "key-1" }),
    ]);
    expect(result[0]).toMatchObject({
      kind: "skip-duplicate",
      canonicalId: "canonical-1",
    });
    // The skip-duplicate row gets dedup_of set and published_at nulled.
    if (result[0].kind === "skip-duplicate") {
      expect(result[0].row.dedup_of).toBe("canonical-1");
      expect(result[0].row.published_at).toBeNull();
    }
  });

  it("merges same source, different source_id, same event_key into the canonical row", async () => {
    // A single connector emitting two source_ids for the same logical event
    // (e.g. a keying-algorithm change). Merge into the canonical id rather
    // than leaving the old row stale and inserting a hidden duplicate —
    // refreshes content, adopts the new source_id, future runs match via
    // sameMap.
    handle.setResponses([
      { data: [], error: null },
      {
        data: [
          {
            id: "canonical-2",
            source: "Website",
            source_id: "first-id",
            event_key: "key-1",
            published_at: "2027-04-01T00:00:00.000Z",
          },
        ],
        error: null,
      },
    ]);
    const { classifyForUpsert } = await import("../persist");
    const result = await classifyForUpsert([
      makeRow({ source: "Website", source_id: "second-id", event_key: "key-1" }),
    ]);
    expect(result[0]).toMatchObject({
      kind: "merge",
      existingId: "canonical-2",
    });
    if (result[0].kind === "merge") {
      // Row carries the NEW source_id verbatim — the merge will overwrite
      // the canonical's old source_id with this new value via id-based
      // UPDATE, so future runs match the cheap same-source path.
      expect(result[0].row.source_id).toBe("second-id");
      // Unlike skip-duplicate, merge doesn't null out published_at or
      // populate dedup_of — the row remains visible content for the
      // canonical id.
      expect(result[0].row.dedup_of).toBeNull();
    }
  });

  it("classifies cross-source source_id collision as skip-duplicate (regression guard for review fix #1)", async () => {
    // Two different sources happen to use the same source_id string for the
    // same logical event. Previously the gate `crossMatch.source_id !== row.source_id`
    // would have let this through as insert; the corrected gate `if (crossMatch)`
    // catches it. This test pins that behavior.
    handle.setResponses([
      { data: [], error: null }, // sameMap miss (source-filtered)
      {
        data: [
          {
            id: "canonical-3",
            source: "Instagram",
            source_id: "denver-festival-may-1",
            event_key: "key-1",
            published_at: "2027-04-01T00:00:00.000Z",
          },
        ],
        error: null,
      },
    ]);
    const { classifyForUpsert } = await import("../persist");
    const result = await classifyForUpsert([
      makeRow({
        source: "Website",
        source_id: "denver-festival-may-1", // same string, different source
        event_key: "key-1",
      }),
    ]);
    expect(result[0].kind).toBe("skip-duplicate");
  });

  it("ignores unpublished rows in the cross-source match (won't dedupe against null published_at)", async () => {
    handle.setResponses([
      { data: [], error: null },
      {
        data: [
          {
            id: "ghost",
            source: "Instagram",
            source_id: "x",
            event_key: "key-1",
            published_at: null, // already a duplicate / not visible
          },
        ],
        error: null,
      },
    ]);
    const { classifyForUpsert } = await import("../persist");
    const result = await classifyForUpsert([
      makeRow({ source: "Website", source_id: "y", event_key: "key-1" }),
    ]);
    expect(result[0].kind).toBe("insert");
  });

  it("preserves dedup_of and keeps the row unpublished when the existing row was a skip-duplicate", async () => {
    // Regression: a row that was previously hidden by a skip-duplicate or
    // LLM-cluster pass has dedup_of set and published_at null in the DB. On
    // re-ingest, the (source, source_id) sameMap hit produces a kind=update,
    // and without preservation logic the bulk upsert would overwrite both
    // fields with the fresh values from buildListingInsert — silently
    // un-hiding the duplicate every time the source's cron fires.
    handle.setResponses([
      {
        data: [
          {
            id: "row-skipped",
            source: "Website",
            source_id: "abc",
            event_key: "key-1",
            dedup_of: "canonical-7",
            published_at: null,
          },
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    const { classifyForUpsert } = await import("../persist");
    const incoming = makeRow({
      source: "Website",
      source_id: "abc",
      event_key: "key-1",
      dedup_of: null,
      published_at: "2027-04-15T10:00:00.000Z",
    });
    const result = await classifyForUpsert([incoming]);
    expect(result[0]).toMatchObject({ kind: "update", existingId: "row-skipped" });
    expect(result[0].row.dedup_of).toBe("canonical-7");
    expect(result[0].row.published_at).toBeNull();
  });

  it("re-publishes on update when the existing row's dedup_of is null (canonical was deleted)", async () => {
    // The dedup_of FK is `on delete set null`, so deleting a canonical row
    // clears the pointer on every duplicate that referenced it. The next
    // ingest of one of those duplicates should treat it as a normal update
    // and re-publish — that row is no longer being deduped against anything.
    const fresh = "2027-04-15T10:00:00.000Z";
    handle.setResponses([
      {
        data: [
          {
            id: "row-orphan",
            source: "Website",
            source_id: "abc",
            event_key: "key-1",
            dedup_of: null,
            published_at: null,
          },
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    const { classifyForUpsert } = await import("../persist");
    const incoming = makeRow({
      source: "Website",
      source_id: "abc",
      event_key: "key-1",
      dedup_of: null,
      published_at: fresh,
    });
    const result = await classifyForUpsert([incoming]);
    expect(result[0]).toMatchObject({ kind: "update", existingId: "row-orphan" });
    // Row passes through unchanged — buildListingInsert's fresh published_at
    // wins, dedup_of stays null. The duplicate's hiding state has lapsed.
    expect(result[0].row.dedup_of).toBeNull();
    expect(result[0].row.published_at).toBe(fresh);
  });

  it("groups by source: a multi-source batch issues one query per distinct source", async () => {
    handle.setResponses([
      // one query per distinct source for sameMap
      { data: [], error: null },
      { data: [], error: null },
      // one event_key query
      { data: [], error: null },
    ]);
    const { classifyForUpsert } = await import("../persist");
    await classifyForUpsert([
      makeRow({ source: "Website", source_id: "a", event_key: "k1" }),
      makeRow({ source: "Instagram", source_id: "b", event_key: "k2" }),
    ]);
    // 2 same-source queries + 1 event_key query = 3 from() calls.
    expect(handle.fromCalls).toHaveLength(3);
    const sources = handle.fromCalls
      .slice(0, 2)
      .map((c) => c.calls.find((x) => x.method === "eq")?.args[1]);
    expect(new Set(sources)).toEqual(new Set(["Website", "Instagram"]));
  });
});

describe("recentFailureStreak", () => {
  it("returns 0 when there are no recent runs", async () => {
    handle.setResponses([{ data: [], error: null }]);
    const { recentFailureStreak } = await import("../persist");
    expect(await recentFailureStreak("test-source")).toBe(0);
  });

  it("counts consecutive failed rows from the top", async () => {
    handle.setResponses([
      {
        data: [
          { status: "failed", started_at: "2027-04-15T10:00:00Z" },
          { status: "failed", started_at: "2027-04-15T09:00:00Z" },
          { status: "ok", started_at: "2027-04-15T08:00:00Z" },
        ],
        error: null,
      },
    ]);
    const { recentFailureStreak } = await import("../persist");
    expect(await recentFailureStreak("test-source")).toBe(2);
  });

  it("breaks the streak on a fresh running row (less than STALE_RUNNING_MS old)", async () => {
    // Live in-flight run at position 0 means we shouldn't count past
    // failures yet — we'd otherwise auto-disable a source that's actually
    // recovering right now.
    const fresh = new Date(Date.now() - 30_000).toISOString(); // 30s ago
    handle.setResponses([
      {
        data: [
          { status: "running", started_at: fresh },
          { status: "failed", started_at: "2027-04-14T00:00:00Z" },
          { status: "failed", started_at: "2027-04-13T00:00:00Z" },
        ],
        error: null,
      },
    ]);
    const { recentFailureStreak } = await import("../persist");
    expect(await recentFailureStreak("test-source")).toBe(0);
  });

  it("counts a stale running row (older than STALE_RUNNING_MS) as failed", async () => {
    // A row stuck at 'running' for >1h is a crashed/abandoned run; counting
    // it as a failure keeps the auto-disable guard accurate when finishRun
    // never reached the DB.
    const stale = new Date(Date.now() - 90 * 60 * 1000).toISOString(); // 90 min ago
    handle.setResponses([
      {
        data: [
          { status: "running", started_at: stale },
          { status: "failed", started_at: "2027-04-14T00:00:00Z" },
        ],
        error: null,
      },
    ]);
    const { recentFailureStreak } = await import("../persist");
    expect(await recentFailureStreak("test-source")).toBe(2);
  });

  it("breaks the streak on an unparseable started_at rather than counting it", async () => {
    // Defensive: if a row's timestamp is somehow corrupt, neither count it
    // nor crash. The break-out behavior is preferable to a streak inflation.
    handle.setResponses([
      {
        data: [
          { status: "running", started_at: "not-a-real-date" },
          { status: "failed", started_at: "2027-04-14T00:00:00Z" },
        ],
        error: null,
      },
    ]);
    const { recentFailureStreak } = await import("../persist");
    expect(await recentFailureStreak("test-source")).toBe(0);
  });

  it("breaks the streak on an 'ok' run", async () => {
    handle.setResponses([
      {
        data: [
          { status: "ok", started_at: "2027-04-15T10:00:00Z" },
          { status: "failed", started_at: "2027-04-15T09:00:00Z" },
        ],
        error: null,
      },
    ]);
    const { recentFailureStreak } = await import("../persist");
    expect(await recentFailureStreak("test-source")).toBe(0);
  });

  it("throws when the underlying lookup fails", async () => {
    handle.setResponses([{ data: null, error: { message: "DB down" } }]);
    const { recentFailureStreak } = await import("../persist");
    await expect(recentFailureStreak("test-source")).rejects.toThrow(/recent-runs lookup failed/);
  });
});

describe("venueSlug", () => {
  it("lowercases and replaces non-alphanumeric runs with single dashes", async () => {
    const { venueSlug } = await import("../persist");
    expect(venueSlug("Mission Ballroom")).toBe("mission-ballroom");
    expect(venueSlug("Red Rocks Amphitheatre")).toBe("red-rocks-amphitheatre");
    expect(venueSlug("Bar & Grill, LLC.")).toBe("bar-grill-llc");
  });

  it("trims leading and trailing dashes", async () => {
    const { venueSlug } = await import("../persist");
    expect(venueSlug("!! The Spot !!")).toBe("the-spot");
  });

  it("falls back to 'venue' when input has no alphanumerics", async () => {
    const { venueSlug } = await import("../persist");
    expect(venueSlug("---")).toBe("venue");
    expect(venueSlug("")).toBe("venue");
  });

  it("caps slug at 60 characters", async () => {
    const { venueSlug } = await import("../persist");
    const long = "a".repeat(120);
    expect(venueSlug(long).length).toBe(60);
  });

  it("appends a city hint as a suffix to disambiguate same-name venues", async () => {
    const { venueSlug } = await import("../persist");
    expect(venueSlug("Mission Ballroom", "Denver, CO")).toBe(
      "mission-ballroom-denver-co",
    );
    expect(venueSlug("Mission Ballroom", "Boulder, CO")).toBe(
      "mission-ballroom-boulder-co",
    );
  });

  it("ignores an empty / unslugifiable city hint", async () => {
    const { venueSlug } = await import("../persist");
    expect(venueSlug("Mission Ballroom", "")).toBe("mission-ballroom");
    expect(venueSlug("Mission Ballroom", "!!!")).toBe("mission-ballroom");
  });

  it("caps the salted slug at 60 characters too", async () => {
    const { venueSlug } = await import("../persist");
    const long = "a".repeat(80);
    expect(venueSlug(long, "Denver, CO").length).toBe(60);
  });
});
