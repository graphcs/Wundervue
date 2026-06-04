import type { Metadata } from "next";
import { getMergedListings } from "@/lib/data/listings.server";
import { applyFilters } from "@/lib/filters/applyFilters";
import { parseSearchParams } from "@/lib/filters/parseSearchParams";
import { paginate } from "@/lib/filters/paginate";
import { reorderForPlan } from "@/lib/auth/insiderGate";
import { getServerPlan } from "@/lib/auth/serverPlan";
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
  const [all, plan] = await Promise.all([
    getMergedListings(),
    getServerPlan(),
  ]);
  const filtered = applyFilters(all, filters);
  const ordered = reorderForPlan(filtered, plan);

  // Map + calendar show the full filtered set (no pagination); grid paginates.
  const showAll = filters.view === "map" || filters.view === "calendar";
  const { items, page, totalPages } = showAll
    ? { items: ordered, page: 1, totalPages: 1 }
    : paginate(ordered, sp, filters.pageSize);

  return (
    <ExploreResults
      listings={items}
      view={filters.view}
      page={page}
      totalPages={totalPages}
      searchParams={sp}
      basePath="/explore"
    />
  );
}
