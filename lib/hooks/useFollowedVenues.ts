"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "wv.followedVenues";
// Same-tab writes don't trigger the native `storage` event, so we dispatch
// our own and have every hook instance listen — keeps the dropdown,
// follow button, and panel in sync without a forced page refresh.
const SYNC_EVENT = "wv.followedVenues:change";

function readInitial(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function persist(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    // Defer the dispatch so subscribers don't setState synchronously during
    // the firing component's render commit (React errors with
    // "Cannot update a component while rendering a different component").
    queueMicrotask(() => window.dispatchEvent(new Event(SYNC_EVENT)));
  } catch {
    // ignore
  }
}

export function useFollowedVenues() {
  const [followed, setFollowed] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setFollowed(readInitial());
    sync();
    setHydrated(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) sync();
    };
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const isFollowed = useCallback(
    (venueId: string) => followed.has(venueId),
    [followed],
  );

  const toggle = useCallback((venueId: string) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(venueId)) next.delete(venueId);
      else next.add(venueId);
      persist(next);
      return next;
    });
  }, []);

  return { followed, isFollowed, toggle, hydrated };
}
