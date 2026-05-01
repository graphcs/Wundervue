export const EXPLORE_PAGE_SIZE = 9;

export function readPageParam(
  sp: Record<string, string | string[] | undefined>,
): number {
  const raw = sp.page;
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(v ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function paginate<T>(
  items: T[],
  sp: Record<string, string | string[] | undefined>,
  pageSize: number = EXPLORE_PAGE_SIZE,
): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, readPageParam(sp)), totalPages);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    totalPages,
  };
}
