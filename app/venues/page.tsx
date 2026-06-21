import type { Metadata } from "next";
import Link from "next/link";
import {
  getBrowseVenues,
  getVenueImageMapBySlug,
} from "@/lib/data/listings.server";
import { VENUE_CATEGORIES, venueCategoryLabel } from "@/lib/data/categories";
import { paginate } from "@/lib/filters/paginate";
import { Pagination } from "@/components/explore/Pagination";

export const metadata: Metadata = {
  title: "Venues",
  description:
    "Browse Denver venues — concert halls, breweries, restaurants, and parks hosting events on Wundervue.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 9;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export default async function VenuesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const activeCat = typeof sp.cat === "string" ? sp.cat : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const [all, imageMap] = await Promise.all([
    getBrowseVenues(),
    getVenueImageMapBySlug(),
  ]);

  const needle = q.toLowerCase();
  const filtered = all.filter((v) => {
    if (activeCat && !v.categories.includes(activeCat)) return false;
    if (needle && !`${v.name} ${v.neighborhood}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  const { items, page, totalPages } = paginate(filtered, sp, PAGE_SIZE);

  // Preserve the active search query when switching category pills.
  const catHref = (slug?: string) => {
    const params = new URLSearchParams();
    if (slug) params.set("cat", slug);
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs ? `/venues?${qs}` : "/venues";
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-7 py-8">
      <header className="mb-5">
        <h1 className="text-dark text-[28px] font-medium leading-tight">Denver Venues</h1>
        <p className="text-gray mt-1 text-[14px]">
          Follow your favorite places to keep up with their upcoming events.
        </p>
      </header>

      <form method="get" action="/venues" className="mb-4 flex gap-2.5">
        {activeCat && <input type="hidden" name="cat" value={activeCat} />}
        <div className="relative flex-1">
          <span className="text-chrome pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search venues by name or neighborhood…"
            className="border-border text-dark placeholder:text-chrome rounded-pill w-full border bg-white py-2.5 pl-11 pr-4 text-sm focus:border-dark focus:outline-none"
          />
        </div>
        <button type="submit" className="bg-dark rounded-pill px-6 text-xs font-medium uppercase tracking-wider text-white hover:opacity-90">
          Search
        </button>
      </form>

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <Link
          href={catHref()}
          className={`rounded-pill border px-3 py-1.5 text-[12px] font-medium transition-colors ${
            !activeCat ? "bg-dark border-dark text-white" : "border-border text-graphite hover:border-dark"
          }`}
        >
          All
        </Link>
        {VENUE_CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={catHref(c.slug)}
            className={`rounded-pill border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              activeCat === c.slug ? "bg-dark border-dark text-white" : "border-border text-graphite hover:border-dark"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <p className="text-gray mb-4 text-[13px]">
        {filtered.length} {filtered.length === 1 ? "venue" : "venues"}
        {activeCat ? ` in ${venueCategoryLabel(activeCat)}` : ""}
        {q ? ` matching “${q}”` : ""}
      </p>

      {items.length === 0 ? (
        <p className="text-gray py-16 text-center text-[14px]">
          No venues found.{" "}
          <Link href="/venues" className="text-coral font-medium hover:underline">
            Clear filters
          </Link>
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((venue) => {
            const imageUrl = imageMap.get(venue.slug);
            return (
              <li key={venue.slug}>
                <Link
                  href={`/venues/${venue.slug}`}
                  className="group border-border flex h-full flex-col overflow-hidden rounded-xl border bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className="bg-tag-bg relative flex h-[140px] w-full items-center justify-center overflow-hidden"
                    style={imageUrl ? undefined : { background: "linear-gradient(135deg, #ffe9ea 0%, #fff5e6 100%)" }}
                  >
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt={venue.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-coral px-3 text-center text-[18px] font-medium tracking-tight">{venue.name}</span>
                    )}
                    <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-dark shadow-sm">
                      {venue.upcomingCount} upcoming
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
                    <h3 className="text-dark text-[15px] font-medium leading-tight">{venue.name}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {venue.neighborhood && (
                        <span className="bg-tag-bg text-graphite rounded-full px-2.5 py-1 text-[11px] font-medium">
                          {venue.neighborhood}
                        </span>
                      )}
                      {venue.categories.slice(0, 3).map((c) => (
                        <span key={c} className="border-border text-graphite rounded-full border px-2.5 py-1 text-[11px] font-medium">
                          {venueCategoryLabel(c)}
                        </span>
                      ))}
                    </div>
                    {venue.description && (
                      <p className="text-graphite line-clamp-2 text-[13px] leading-snug">{venue.description}</p>
                    )}
                    {venue.address && (
                      <div className="text-gray mt-auto flex items-center gap-1.5 pt-1 text-[11px]">
                        <PinIcon />
                        <span className="line-clamp-1">{venue.address}</span>
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} basePath="/venues" />
        </div>
      )}
    </div>
  );
}
