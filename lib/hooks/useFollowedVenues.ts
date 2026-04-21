"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "wv.followedVenues";

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
  } catch {
    // ignore
  }
}

export function useFollowedVenues() {
  const [followed, setFollowed] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFollowed(readInitial());
    setHydrated(true);
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
