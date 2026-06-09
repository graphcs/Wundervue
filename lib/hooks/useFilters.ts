"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildHref } from "@/lib/filters/buildHref";
import { parseSearchParams } from "@/lib/filters/parseSearchParams";
import { locationBySlug } from "@/lib/data/locations";
import { CATEGORIES } from "@/lib/data/categories";
import type { Filters, LifestyleTag } from "@/lib/types";

const VALID_CATS = new Set(CATEGORIES.map((c) => c.slug));

function extractPathContext(pathname: string): {
  pathNeighborhood?: string;
  pathCategory?: string;
} {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "explore") return {};

  let pathNeighborhood: string | undefined;
  let pathCategory: string | undefined;

  // A path segment is a location if it resolves to any taxonomy node
  // (region/city/neighborhood); otherwise check the category list.
  for (let i = 1; i < segments.length; i++) {
    const s = segments[i];
    if (locationBySlug(s)) pathNeighborhood = s;
    else if (VALID_CATS.has(s)) pathCategory = s;
  }

  return { pathNeighborhood, pathCategory };
}

export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pathCtx = useMemo(() => extractPathContext(pathname), [pathname]);

  const filters = useMemo(
    () =>
      parseSearchParams(searchParams, {
        neighborhoodFromPath: pathCtx.pathNeighborhood,
        categoryFromPath: pathCtx.pathCategory,
      }),
    [searchParams, pathCtx],
  );

  const replaceFilters = useCallback(
    (next: Partial<Filters>) => {
      const merged: Filters = { ...filters, ...next };
      const href = buildHref({
        pathNeighborhood: pathCtx.pathNeighborhood,
        pathCategory: pathCtx.pathCategory,
        filters: merged,
      });
      router.replace(href, { scroll: false });
    },
    [filters, pathCtx, router],
  );

  const toggleLifestyle = useCallback(
    (tag: LifestyleTag) => {
      const active = filters.lifestyle.includes(tag);
      const next = active
        ? filters.lifestyle.filter((t) => t !== tag)
        : [...filters.lifestyle, tag];
      replaceFilters({ lifestyle: next });
    },
    [filters.lifestyle, replaceFilters],
  );

  const toggleNeighborhood = useCallback(
    (slug: string) => {
      const active = filters.neighborhoods.includes(slug);
      const next = active
        ? filters.neighborhoods.filter((s) => s !== slug)
        : [...filters.neighborhoods, slug];
      replaceFilters({ neighborhoods: next });
    },
    [filters.neighborhoods, replaceFilters],
  );

  const toggleCategory = useCallback(
    (slug: string) => {
      const active = filters.categories.includes(slug);
      const next = active
        ? filters.categories.filter((s) => s !== slug)
        : [...filters.categories, slug];
      replaceFilters({ categories: next });
    },
    [filters.categories, replaceFilters],
  );

  const clearAll = useCallback(() => {
    router.replace(
      buildHref({
        pathNeighborhood: pathCtx.pathNeighborhood,
        pathCategory: pathCtx.pathCategory,
        filters: {
          type: "all",
          neighborhoods: [],
          categories: [],
          date: "any",
          lifestyle: [],
          freeOnly: false,
          sort: filters.sort,
          view: filters.view,
          tab: filters.tab,
          pageSize: filters.pageSize,
        },
      }),
      { scroll: false },
    );
  }, [pathCtx, router, filters.sort, filters.view, filters.tab, filters.pageSize]);

  return {
    filters,
    pathNeighborhood: pathCtx.pathNeighborhood,
    pathCategory: pathCtx.pathCategory,
    replaceFilters,
    toggleLifestyle,
    toggleNeighborhood,
    toggleCategory,
    clearAll,
  };
}
