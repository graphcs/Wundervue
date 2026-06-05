"use client";

import { useEffect, useState } from "react";
import type { Listing } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { SAVED_LISTING_COLUMNS, rowToListing } from "@/lib/data/clientListings";

// Fetch a user's saved listings by id, browser-side. Shared by the account
// Saved and Calendar tabs so the query + mapping live in one place. Re-fetches
// only when the set of ids changes (order-independent).
export function useSavedListings(ids: string[]): { listings: Listing[]; loading: boolean } {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const key = ids.slice().sort().join(",");

  useEffect(() => {
    if (ids.length === 0) {
      setListings([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sb = getSupabaseBrowserClient();
      const { data } = await sb.from("listings").select(SAVED_LISTING_COLUMNS).in("id", ids);
      if (cancelled) return;
      setListings(((data ?? []) as Array<Record<string, unknown>>).map(rowToListing));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // key is the order-independent digest of ids; ids itself is a new array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { listings, loading };
}
