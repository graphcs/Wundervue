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

function readInitial(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as Array<string | number>;
    return new Set(arr.map((v) => String(v)));
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

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFavorites(readInitial());
    setHydrated(true);
  }, []);

  const isFavorited = useCallback(
    (id: string) => favorites.has(id),
    [favorites],
  );

  const toggle = useCallback(
    (id: string, opts: { plan?: "free" | "insider" } = {}) => {
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
