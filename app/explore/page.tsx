import type { Metadata } from "next";
import { getMergedListings } from "@/lib/data/listings.server";
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
  const all = await getMergedListings();
  const listings = applyFilters(all, filters);
  return <ExploreResults listings={listings} view={filters.view} />;
}
