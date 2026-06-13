import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getMergedListings } from "@/lib/data/listings.server";
import {
  NEIGHBORHOODS_ALL,
  isPlaceSlug,
  legacyPlaceRedirect,
  locationBySlug,
} from "@/lib/data/locations";
import { CATEGORIES, categoryLabel } from "@/lib/data/categories";
import { applyFilters } from "@/lib/filters/applyFilters";
import { parseSearchParams } from "@/lib/filters/parseSearchParams";
import { forYouHref, withQuery } from "@/lib/filters/buildHref";
import { paginate } from "@/lib/filters/paginate";
import { ExploreResults } from "@/components/explore/ExploreResults";

interface PageProps {
  params: Promise<{ segment: string; category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Any neighborhood or city is a valid place segment (isPlaceSlug); city × category
// combos render on-demand (dynamicParams). Pre-build the Central Denver
// neighborhood × category pages — the highest-value SEO set — to bound the build.
const CAT_SLUGS = new Set(CATEGORIES.map((c) => c.slug));

export async function generateStaticParams() {
  return NEIGHBORHOODS_ALL.flatMap((n) =>
    CATEGORIES.map((c) => ({ segment: n.slug, category: c.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { segment, category } = await params;
  // Gate on isPlaceSlug so region/area/city-group slugs (which the page 404s)
  // don't get real metadata from locationBySlug's broader lookup.
  const place = isPlaceSlug(segment) ? locationBySlug(segment)?.label : undefined;
  const cat = categoryLabel(category);
  if (!place || !cat) return { title: "Explore Denver" };
  return {
    title: `${cat} in ${place}`,
    description: `Find ${cat.toLowerCase()} events and deals in ${place}.`,
  };
}

export default async function ExploreCombinedPage({
  params,
  searchParams,
}: PageProps) {
  const { segment, category } = await params;
  const sp = await searchParams;

  if (!isPlaceSlug(segment) || !CAT_SLUGS.has(category)) {
    // Permanently forward legacy /explore/<old-slug>/<category> URLs (308).
    const successor = legacyPlaceRedirect(segment);
    if (successor && CAT_SLUGS.has(category)) {
      permanentRedirect(withQuery(`/explore/${successor}/${category}`, sp));
    }
    notFound();
  }

  const filters = parseSearchParams(sp, {
    neighborhoodFromPath: segment,
    categoryFromPath: category,
  });
  // For You is a global personalized feed (gated + ranked on the homepage), not
  // segment-scoped — send it there (keeping query filters) instead of a grid.
  if (filters.tab === "for-you") redirect(forYouHref(sp));
  const all = await getMergedListings();
  const filtered = applyFilters(all, filters);

  const showAll = filters.view === "map" || filters.view === "calendar";
  const { items, page, totalPages } = showAll
    ? { items: filtered, page: 1, totalPages: 1 }
    : paginate(filtered, sp, filters.pageSize);

  return (
    <ExploreResults
      listings={items}
      view={filters.view}
      page={page}
      totalPages={totalPages}
      searchParams={sp}
      basePath={`/explore/${segment}/${category}`}
    />
  );
}
