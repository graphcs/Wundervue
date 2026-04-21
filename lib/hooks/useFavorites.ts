"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "wv.favorites";
const FREE_LIMIT = 5;

export class FavoriteLimitReached extends Error {
  constructor() {
    super("Free plan limited to 5 favorites");
    this.name = "FavoriteLimitReached";
  }
}

function readInitial(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function persist(set: Set<number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<number>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFavorites(readInitial());
    setHydrated(true);
  }, []);

  const isFavorited = useCallback(
    (id: number) => favorites.has(id),
    [favorites],
  );

  const toggle = useCallback(
    (id: number, opts: { plan?: "free" | "insider" } = {}) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          if (opts.plan !== "insider" && next.size >= FREE_LIMIT) {
            throw new FavoriteLimitReached();
          }
          next.add(id);
        }
        persist(next);
        return next;
      });
    },
    [],
  );

  return { favorites, isFavorited, toggle, hydrated, limit: FREE_LIMIT };
}
