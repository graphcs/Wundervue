import { DEFAULT_PAGE_SIZE } from "./types";

export function readPageParam(
  sp: Record<string, string | string[] | undefined>,
): number {
  const raw = sp.page;
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function paginate<T>(
  items: T[],
  sp: Record<string, string | string[] | undefined>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, readPageParam(sp)), totalPages);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    totalPages,
  };
}

// Returns a function that builds the href for a given page. The non-page
// search params are stringified once, so rendering N page links is O(N) work
// instead of re-parsing on every call.
export function buildPageHrefBuilder(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
): (page: number) => string {
  const baseParams = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === "page") continue;
    if (Array.isArray(v)) v.forEach((vv) => baseParams.append(k, vv));
    else if (v) baseParams.set(k, v);
  }
  const baseQs = baseParams.toString();
  return (page: number) => {
    if (page <= 1) return baseQs ? `${basePath}?${baseQs}` : basePath;
    const qs = baseQs ? `${baseQs}&page=${page}` : `page=${page}`;
    return `${basePath}?${qs}`;
  };
}

export function buildPageHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  return buildPageHrefBuilder(basePath, searchParams)(page);
}

export function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}
