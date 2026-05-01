import Link from "next/link";

interface Props {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
}

function buildHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === "page") continue;
    if (Array.isArray(v)) v.forEach((vv) => params.append(k, vv));
    else if (v) params.set(k, v);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function pageWindow(current: number, total: number): (number | "…")[] {
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

export function Pagination({
  currentPage,
  totalPages,
  searchParams,
  basePath,
}: Props) {
  if (totalPages <= 1) return null;
  const items = pageWindow(currentPage, totalPages);
  const prevHref = buildHref(basePath, searchParams, Math.max(1, currentPage - 1));
  const nextHref = buildHref(
    basePath,
    searchParams,
    Math.min(totalPages, currentPage + 1),
  );
  const baseBtn =
    "border-border text-graphite inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors";

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-center gap-2"
    >
      {currentPage > 1 ? (
        <Link
          href={prevHref}
          className={`${baseBtn} hover:border-coral hover:text-coral bg-white`}
          aria-label="Previous page"
        >
          ←
        </Link>
      ) : (
        <span
          className={`${baseBtn} text-gray cursor-not-allowed bg-white opacity-50`}
          aria-disabled="true"
        >
          ←
        </span>
      )}
      {items.map((it, idx) =>
        it === "…" ? (
          <span key={`gap-${idx}`} className="text-gray px-1 text-sm">
            …
          </span>
        ) : it === currentPage ? (
          <span
            key={it}
            aria-current="page"
            className={`${baseBtn} bg-coral border-coral text-white`}
          >
            {it}
          </span>
        ) : (
          <Link
            key={it}
            href={buildHref(basePath, searchParams, it)}
            className={`${baseBtn} hover:border-coral hover:text-coral bg-white`}
          >
            {it}
          </Link>
        ),
      )}
      {currentPage < totalPages ? (
        <Link
          href={nextHref}
          className={`${baseBtn} hover:border-coral hover:text-coral bg-white`}
          aria-label="Next page"
        >
          →
        </Link>
      ) : (
        <span
          className={`${baseBtn} text-gray cursor-not-allowed bg-white opacity-50`}
          aria-disabled="true"
        >
          →
        </span>
      )}
    </nav>
  );
}
