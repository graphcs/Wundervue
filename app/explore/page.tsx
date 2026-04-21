import type { Metadata } from "next";
import { LISTINGS } from "@/lib/data/listings";
import { applyFilters } from "@/lib/filters/applyFilters";
import { parseSearchParams } from "@/lib/filters/parseSearchParams";
import { ExploreResults } from "@/components/explore/ExploreResults";

export const metadata: Metadata = {
  title: "Explore Denver — Events & Deals",
  description:
    "Browse every event, deal, and thing to do in Denver this week. Filter by neighborhood, category, or lifestyle.",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ExplorePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseSearchParams(sp);
  const listings = applyFilters(LISTINGS, filters);
  return <ExploreResults listings={listings} view={filters.view} />;
}
