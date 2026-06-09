import type { Filters } from "@/lib/types";
import { DEFAULT_PAGE_SIZE } from "./types";

export interface HrefInput {
  pathNeighborhood?: string;
  pathCategory?: string;
  filters: Partial<Filters>;
}

export function buildHref({
  pathNeighborhood,
  pathCategory,
  filters,
}: HrefInput): string {
  // The homepage `/` is the canonical feed; only the SEO segment pages live
  // under /explore/<neighborhood|category>.
  let base = "/";
  if (pathNeighborhood || pathCategory) {
    const segments = ["explore"];
    if (pathNeighborhood) segments.push(pathNeighborhood);
    if (pathCategory) segments.push(pathCategory);
    base = "/" + segments.join("/");
  }

  const sp = new URLSearchParams();

  if (filters.type && filters.type !== "all") sp.set("type", filters.type);
  if (filters.date && filters.date !== "any") sp.set("date", filters.date);
  if (filters.from) sp.set("from", filters.from);
  if (filters.to) sp.set("to", filters.to);

  const extraHoods = (filters.neighborhoods ?? []).filter(
    (h) => h !== pathNeighborhood,
  );
  if (extraHoods.length) sp.set("hoods", extraHoods.join(","));

  const extraCats = (filters.categories ?? []).filter(
    (c) => c !== pathCategory,
  );
  if (extraCats.length) sp.set("cats", extraCats.join(","));

  if (filters.lifestyle && filters.lifestyle.length) {
    sp.set("lifestyle", filters.lifestyle.join(","));
  }
  if (filters.freeOnly) sp.set("free", "1");
  if (filters.q) sp.set("q", filters.q);
  if (filters.sort && filters.sort !== "soonest") sp.set("sort", filters.sort);
  // Persist any non-default view (grid is the default, so it's omitted).
  if (filters.view && filters.view !== "grid") {
    sp.set("view", filters.view);
  }
  // Persist any non-default feed tab (all is the default, so it's omitted).
  if (filters.tab && filters.tab !== "all") {
    sp.set("tab", filters.tab);
  }
  if (filters.pageSize && filters.pageSize !== DEFAULT_PAGE_SIZE) {
    sp.set("per", String(filters.pageSize));
  }
  if (filters.venue) sp.set("venue", filters.venue);

  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

// Homepage For-You URL that preserves the query filters (q/sort/date/…). The
// path segment is intentionally dropped — For-You is a global, not segment-
// scoped, feed. Used by the segment pages to forward a `tab=for-you` request.
export function forYouHref(
  sp: Record<string, string | string[] | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "tab" || k === "view") continue; // tab is set explicitly below
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
    else if (v) qs.set(k, v);
  }
  qs.set("tab", "for-you");
  return `/?${qs.toString()}`;
}
