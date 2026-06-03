"use client";

import { useCallback } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import {
  AuthRequiredError,
  createUserCollectionStore,
  useUserCollection,
} from "./userCollection";

const FREE_LIMIT = 10;

export { AuthRequiredError };

export class FavoriteLimitReached extends Error {
  constructor() {
    super(`Free plan limited to ${FREE_LIMIT} favorites`);
    this.name = "FavoriteLimitReached";
  }
}

// Module-level singleton so every fav button / dropdown / panel shares state.
// NB: favorites.listing_id is a uuid column, so only DB-backed listings persist.
// Favoriting an in-memory fixture listing (non-uuid id) optimistically toggles
// but the insert is rejected and rolled back — acceptable since fixtures are
// demo-only and real listings always carry uuids.
const store = createUserCollectionStore({ table: "favorites", idColumn: "listing_id" });

export function useFavorites() {
  const { session, hydrated: authHydrated } = useAuthContext();
  const userId = session?.userId ?? null;
  const { ids: favorites, loaded } = useUserCollection(store, userId, authHydrated);

  const isFavorited = useCallback((id: string) => store.has(id), []);

  const toggle = useCallback(
    (id: string, opts: { plan?: "free" | "insider" } = {}) => {
      if (!userId) throw new AuthRequiredError();
      const isAdding = !store.has(id);
      if (isAdding && opts.plan !== "insider" && store.getIds().size >= FREE_LIMIT) {
        throw new FavoriteLimitReached();
      }
      store.mutate(id, isAdding);
    },
    [userId],
  );

  return {
    favorites,
    isFavorited,
    toggle,
    hydrated: authHydrated && loaded,
    limit: FREE_LIMIT,
  };
}
