import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMergedListings } from "@/lib/data/listings.server";
import {
  NEIGHBORHOODS,
  neighborhoodLabel,
} from "@/lib/data/neighborhoods";
import { CATEGORIES, categoryLabel } from "@/lib/data/categories";
import { applyFilters } from "@/lib/filters/applyFilters";
import { parseSearchParams } from "@/lib/filters/parseSearchParams";
import { forYouHref } from "@/lib/filters/buildHref";
import { paginate } from "@/lib/filters/paginate";
import { ExploreResults } from "@/components/explore/ExploreResults";

interface PageProps {
  params: Promise<{ segment: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const HOOD_SLUGS = new Set(NEIGHBORHOODS.map((n) => n.slug));
const CAT_SLUGS = new Set(CATEGORIES.map((c) => c.slug));

export async function generateStaticParams() {
  return [
    ...NEIGHBORHOODS.map((n) => ({ segment: n.slug })),
    ...CATEGORIES.map((c) => ({ segment: c.slug })),
  ];
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { segment } = await params;
  if (HOOD_SLUGS.has(segment)) {
    const label = neighborhoodLabel(segment) ?? segment;
    return {
      title: `${label} Events & Deals`,
      description: `Discover events, deals, and things to do in ${label}, Denver. Concerts, food & drink, outdoor activities, and more.`,
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

  const isHood = HOOD_SLUGS.has(segment);
  const isCat = CAT_SLUGS.has(segment);

  if (!isHood && !isCat) notFound();

  const filters = parseSearchParams(sp, {
    neighborhoodFromPath: isHood ? segment : undefined,
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
