"use client";

import { useCallback } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import {
  AuthRequiredError,
  createUserCollectionStore,
  useUserCollection,
} from "./userCollection";

export { AuthRequiredError };

// Following venues is uncapped for any signed-in user (per the User Tiers
// matrix). Kept as an exported error for backward-compatible imports — it is
// no longer thrown.
export class FollowLimitReached extends Error {
  constructor() {
    super("Follow limit reached");
    this.name = "FollowLimitReached";
  }
}

// NB: the venue_follows table keys follows by venue *slug* (column venue_slug),
// so every call site passes a venue slug, not the fixture numeric id.
const store = createUserCollectionStore({ table: "venue_follows", idColumn: "venue_slug" });

export function useFollowedVenues() {
  const { session, hydrated: authHydrated } = useAuthContext();
  const userId = session?.userId ?? null;
  const { ids: followed, loaded } = useUserCollection(store, userId, authHydrated);

  const isFollowed = useCallback((venueId: string) => store.has(venueId), []);

  const toggle = useCallback(
    (venueId: string) => {
      if (!userId) throw new AuthRequiredError();
      store.mutate(venueId, !store.has(venueId));
    },
    [userId],
  );

  return { followed, isFollowed, toggle, hydrated: authHydrated && loaded };
}
