import Link from "next/link";
import { buildPageHrefBuilder, pageWindow } from "@/lib/filters/paginate";

interface Props {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
}

export function Pagination({
  currentPage,
  totalPages,
  searchParams,
  basePath,
}: Props) {
  if (totalPages <= 1) return null;
  const items = pageWindow(currentPage, totalPages);
  const hrefFor = buildPageHrefBuilder(basePath, searchParams);
  const prevHref = hrefFor(Math.max(1, currentPage - 1));
  const nextHref = hrefFor(Math.min(totalPages, currentPage + 1));
  const baseBtn =
    "border-border text-graphite inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors";

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-2"
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
            href={hrefFor(it)}
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
