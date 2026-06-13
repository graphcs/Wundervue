import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getMergedListings } from "@/lib/data/listings.server";
import {
  ALL_PLACES,
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
  params: Promise<{ segment: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const CAT_SLUGS = new Set(CATEGORIES.map((c) => c.slug));

export async function generateStaticParams() {
  // A page per browsable place (all neighborhoods + metro cities) and category.
  return [
    ...ALL_PLACES.map((p) => ({ segment: p.slug })),
    ...CATEGORIES.map((c) => ({ segment: c.slug })),
  ];
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { segment } = await params;
  if (isPlaceSlug(segment)) {
    const label = locationBySlug(segment)?.label ?? segment;
    return {
      title: `${label} Events & Deals`,
      description: `Discover events, deals, and things to do in ${label}. Concerts, food & drink, outdoor activities, and more.`,
    };
  }
  if (CAT_SLUGS.has(segment)) {
    const label = categoryLabel(segment) ?? segment;
    return {
      title: `${label} in Denver`,
      description: `Browse ${label} events and deals across Denver's neighborhoods.`,
    };
  }
  return { title: "Explore Denver" };
}

export default async function ExploreSegmentPage({
  params,
  searchParams,
}: PageProps) {
  const { segment } = await params;
  const sp = await searchParams;

  const isPlace = isPlaceSlug(segment);
  const isCat = CAT_SLUGS.has(segment);

  if (!isPlace && !isCat) {
    // Permanently forward legacy /explore/<old-slug> URLs to the successor (308,
    // so search engines move their index to the canonical place page).
    const successor = legacyPlaceRedirect(segment);
    if (successor) permanentRedirect(withQuery(`/explore/${successor}`, sp));
    notFound();
  }

  const filters = parseSearchParams(sp, {
    neighborhoodFromPath: isPlace ? segment : undefined,
    categoryFromPath: isCat ? segment : undefined,
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
      basePath={`/explore/${segment}`}
    />
  );
}
