import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Configurable response the mocked query builder resolves to.
let nextResponse: { data: unknown[]; error: unknown } = { data: [], error: null };
const calls: Array<{ method: string; args: unknown[] }> = [];

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  // Bind the response when the query is issued (synchronously, as each chain
  // method is called) rather than when `await` adopts the thenable on a later
  // microtask — otherwise two in-flight queries would both read the latest
  // global nextResponse.
  let resp = nextResponse;
  for (const m of ["select", "insert", "delete", "eq"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      resp = nextResponse;
      return builder;
    };
  }
  builder.then = (onFulfilled: (v: typeof nextResponse) => unknown) =>
    Promise.resolve(resp).then(onFulfilled);
  return builder;
}

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ from: () => makeBuilder() }),
}));

import {
  AuthRequiredError,
  createUserCollectionStore,
} from "../userCollection";

// Flush the microtask queue so async load()/mutate() writes settle.
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  nextResponse = { data: [], error: null };
  calls.length = 0;
});
afterEach(() => vi.clearAllMocks());

function newStore() {
  return createUserCollectionStore({ table: "favorites", idColumn: "listing_id" });
}

describe("userCollection store", () => {
  it("resets to empty + loaded when logged out", async () => {
    const store = newStore();
    store.syncUser(null);
    await flush();
    expect(store.isLoaded()).toBe(true);
    expect(store.getIds().size).toBe(0);
  });

  it("loads ids for a signed-in user", async () => {
    nextResponse = { data: [{ listing_id: "a" }, { listing_id: "b" }], error: null };
    const store = newStore();
    store.syncUser("user-1");
    await flush();
    expect(store.isLoaded()).toBe(true);
    expect(store.has("a")).toBe(true);
    expect(store.has("b")).toBe(true);
    expect(store.has("c")).toBe(false);
  });

  it("optimistically adds, then persists", async () => {
    const store = newStore();
    store.syncUser("user-1");
    await flush();

    store.mutate("x", true);
    expect(store.has("x")).toBe(true); // optimistic, synchronous
    await flush();
    expect(store.has("x")).toBe(true); // still set after successful write
    expect(calls.some((c) => c.method === "insert")).toBe(true);
  });

  it("rolls back an add when the write fails", async () => {
    const store = newStore();
    store.syncUser("user-1");
    await flush();

    nextResponse = { data: [], error: { message: "boom" } };
    store.mutate("x", true);
    expect(store.has("x")).toBe(true); // optimistic
    await flush();
    expect(store.has("x")).toBe(false); // rolled back
  });

  it("throws AuthRequiredError when no user is set", () => {
    const store = newStore();
    expect(() => store.mutate("x", true)).toThrow(AuthRequiredError);
  });

  it("rolls back only the failed id, preserving a concurrent mutation", async () => {
    const store = newStore();
    store.syncUser("user-1");
    await flush();

    // A's write fails; B's (started while A is in flight) succeeds.
    nextResponse = { data: [], error: { message: "boom" } };
    store.mutate("A", true);
    nextResponse = { data: [], error: null };
    store.mutate("B", true);

    expect(store.has("A")).toBe(true); // both optimistic
    expect(store.has("B")).toBe(true);
    await flush();

    expect(store.has("A")).toBe(false); // failed write rolled back
    expect(store.has("B")).toBe(true); // concurrent mutation NOT clobbered
  });

  it("does not reload for the same user (dedup)", async () => {
    nextResponse = { data: [{ listing_id: "a" }], error: null };
    const store = newStore();
    store.syncUser("user-1");
    await flush();
    const selectsAfterFirst = calls.filter((c) => c.method === "select").length;
    store.syncUser("user-1");
    await flush();
    expect(calls.filter((c) => c.method === "select").length).toBe(selectsAfterFirst);
  });
});
