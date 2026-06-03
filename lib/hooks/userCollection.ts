"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Thrown by a collection's toggle when no one is signed in. Callers catch this
// to open the login modal — saving/following requires an account.
export class AuthRequiredError extends Error {
  constructor() {
    super("You must be signed in to do that");
    this.name = "AuthRequiredError";
  }
}

export interface CollectionConfig {
  /** Supabase table, e.g. "favorites" | "venue_follows". */
  table: string;
  /** The id column holding the saved entity, e.g. "listing_id" | "venue_id". */
  idColumn: string;
}

export interface UserCollectionStore {
  subscribe: (fn: () => void) => () => void;
  getIds: () => Set<string>;
  isLoaded: () => boolean;
  /** Load (or reset) the collection for a user. Deduped across instances. */
  syncUser: (userId: string | null) => void;
  has: (id: string) => boolean;
  /** Optimistically add/remove with a DB write + rollback on failure. */
  mutate: (id: string, add: boolean) => void;
}

const EMPTY: Set<string> = new Set();

// One module-level store per collection, shared by every hook instance so the
// fav button, dropdown count, and panels stay in sync without a refetch.
export function createUserCollectionStore(config: CollectionConfig): UserCollectionStore {
  let ids: Set<string> = EMPTY;
  let loaded = false;
  let userId: string | null = null;
  // Sentinel distinct from null ("logged out") so the first sync always runs.
  let lastSyncedUserId: string | null | undefined = undefined;
  const listeners = new Set<() => void>();

  function notify() {
    for (const fn of listeners) fn();
  }

  async function load() {
    if (!userId) {
      ids = EMPTY;
      loaded = true;
      notify();
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from(config.table)
      .select(config.idColumn)
      .eq("user_id", userId);
    if (error) {
      console.error(`[${config.table}] load failed`, error);
      ids = EMPTY;
    } else {
      ids = new Set(
        ((data ?? []) as Array<Record<string, unknown>>).map((r) =>
          String(r[config.idColumn]),
        ),
      );
    }
    loaded = true;
    notify();
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getIds: () => ids,
    isLoaded: () => loaded,
    syncUser(nextUserId) {
      if (nextUserId === lastSyncedUserId) return;
      lastSyncedUserId = nextUserId;
      userId = nextUserId;
      loaded = false;
      ids = EMPTY;
      notify();
      void load();
    },
    has: (id) => ids.has(id),
    mutate(id, add) {
      if (!userId) throw new AuthRequiredError();
      const prev = ids;
      const next = new Set(prev);
      if (add) next.add(id);
      else next.delete(id);
      ids = next;
      notify();

      const supabase = getSupabaseBrowserClient();
      void (async () => {
        const { error } = add
          ? await supabase.from(config.table).insert({ user_id: userId, [config.idColumn]: id })
          : await supabase
              .from(config.table)
              .delete()
              .eq("user_id", userId)
              .eq(config.idColumn, id);
        if (error) {
          console.error(`[${config.table}] ${add ? "insert" : "delete"} failed`, error);
          ids = prev; // rollback the optimistic change
          notify();
        }
      })();
    },
  };
}

// Wires a store into React: subscribes for ids + loaded state, and syncs the
// collection whenever the signed-in user changes (once auth has hydrated).
export function useUserCollection(
  store: UserCollectionStore,
  userId: string | null,
  authHydrated: boolean,
): { ids: Set<string>; loaded: boolean } {
  const ids = useSyncExternalStore(
    store.subscribe,
    store.getIds,
    () => EMPTY,
  );
  const loaded = useSyncExternalStore(
    store.subscribe,
    store.isLoaded,
    () => false,
  );

  useEffect(() => {
    if (!authHydrated) return;
    store.syncUser(userId);
  }, [store, userId, authHydrated]);

  return { ids, loaded };
}
