import type { Filters } from "@/lib/types";

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
  const segments = ["explore"];
  if (pathNeighborhood) segments.push(pathNeighborhood);
  if (pathCategory) segments.push(pathCategory);
  const base = "/" + segments.join("/");

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
  if (filters.pageSize && filters.pageSize !== 9) {
    sp.set("per", String(filters.pageSize));
  }
  if (filters.venue) sp.set("venue", filters.venue);

  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}
