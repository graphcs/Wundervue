import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMergedListings } from "@/lib/data/listings.server";
import {
  NEIGHBORHOODS,
  neighborhoodLabel,
} from "@/lib/data/neighborhoods";
import { CATEGORIES, categoryLabel } from "@/lib/data/categories";
import { applyFilters } from "@/lib/filters/applyFilters";
import { parseSearchParams } from "@/lib/filters/parseSearchParams";
import { ExploreResults } from "@/components/explore/ExploreResults";

interface PageProps {
  params: Promise<{ segment: string; category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const HOOD_SLUGS = new Set(NEIGHBORHOODS.map((n) => n.slug));
const CAT_SLUGS = new Set(CATEGORIES.map((c) => c.slug));

export async function generateStaticParams() {
  return NEIGHBORHOODS.flatMap((n) =>
    CATEGORIES.map((c) => ({ segment: n.slug, category: c.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { segment, category } = await params;
  const hood = neighborhoodLabel(segment);
  const cat = categoryLabel(category);
  if (!hood || !cat) return { title: "Explore Denver" };
  return {
    title: `${cat} in ${hood}`,
    description: `Find ${cat.toLowerCase()} events and deals in ${hood}, Denver.`,
  };
}

export default async function ExploreCombinedPage({
  params,
  searchParams,
}: PageProps) {
  const { segment, category } = await params;
  const sp = await searchParams;

  if (!HOOD_SLUGS.has(segment) || !CAT_SLUGS.has(category)) notFound();

  const filters = parseSearchParams(sp, {
    neighborhoodFromPath: segment,
    categoryFromPath: category,
  });
  const all = await getMergedListings();
  const listings = applyFilters(all, filters);

  return <ExploreResults listings={listings} view={filters.view} />;
}
