"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "wv.followedVenues";
const FREE_LIMIT = 3;
// Same-tab writes don't trigger the native `storage` event, so we dispatch
// our own and have every hook instance listen — keeps the dropdown,
// follow button, and panel in sync without a forced page refresh.
const SYNC_EVENT = "wv.followedVenues:change";

export class FollowLimitReached extends Error {
  constructor() {
    super("Free plan limited to 3 saved venues");
    this.name = "FollowLimitReached";
  }
}

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
  // Mirror state in a ref so toggle() can read the latest set synchronously
  // without listing `followed` in its useCallback deps. Throwing inside a
  // setState updater would surface to React's error boundary instead of the
  // caller's try/catch under concurrent React, so we check the limit here.
  const followedRef = useRef<Set<string>>(followed);

  useEffect(() => {
    followedRef.current = followed;
  }, [followed]);

  useEffect(() => {
    const sync = () => {
      const initial = readInitial();
      followedRef.current = initial;
      setFollowed(initial);
    };
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

  const toggle = useCallback(
    (venueId: string, opts: { plan?: "free" | "insider" } = {}) => {
      const current = followedRef.current;
      const isAdding = !current.has(venueId);
      if (
        isAdding &&
        opts.plan !== "insider" &&
        current.size >= FREE_LIMIT
      ) {
        throw new FollowLimitReached();
      }
      setFollowed((prev) => {
        const next = new Set(prev);
        if (next.has(venueId)) next.delete(venueId);
        else next.add(venueId);
        followedRef.current = next;
        persist(next);
        return next;
      });
    },
    [],
  );

  return { followed, isFollowed, toggle, hydrated, limit: FREE_LIMIT };
}
