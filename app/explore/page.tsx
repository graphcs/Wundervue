import type { Metadata } from "next";
import { getMergedListings } from "@/lib/data/listings.server";
import { applyFilters } from "@/lib/filters/applyFilters";
import { parseSearchParams } from "@/lib/filters/parseSearchParams";
import { paginate } from "@/lib/filters/paginate";
import { reorderForPlan } from "@/lib/auth/insiderGate";
import { getServerProfile } from "@/lib/auth/serverPlan";
import { getForYouSignals } from "@/lib/data/forYouSignals.server";
import { rankForYouWith, forYouReasons } from "@/lib/data/recommendations";
import { buildWanted } from "@/lib/data/profileTaxonomy";
import { categorySlug } from "@/lib/data/categories";
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
  const [all, profile] = await Promise.all([
    getMergedListings(),
    getServerProfile(),
  ]);
  const plan = profile?.plan ?? null;
  const filtered = applyFilters(all, filters);

  // For You is Insider-only personalized ranking; free/guests get the upgrade
  // state (the toggle gates too, but guard the direct ?view=for-you URL here).
  const forYouLocked = filters.view === "for-you" && (plan !== "insider" || !profile);

  let items: typeof filtered;
  let page = 1;
  let totalPages = 1;
  let reasons: Record<string, string> | undefined;
  if (forYouLocked) {
    items = [];
  } else if (filters.view === "for-you") {
    // Behavioral signals filters can't express: followed venues + learned taste
    // from past saves; already-saved listings are dropped.
    const signals = await getForYouSignals();
    const byId = new Map(all.map((l) => [l.id, l]));
    const savedCategorySlugs = new Set<string>();
    const savedNeighborhoods = new Set<string>();
    for (const id of signals.savedIds) {
      const saved = byId.get(id);
      if (!saved) continue;
      const slug = saved.category ? categorySlug(saved.category) : undefined;
      if (slug) savedCategorySlugs.add(slug);
      if (saved.neighborhood) savedNeighborhoods.add(saved.neighborhood);
    }
    const behavior = {
      savedIds: signals.savedIds,
      followedVenues: signals.followedVenues,
      savedCategorySlugs,
      savedNeighborhoods,
    };
    // Build the taxonomy "wanted" set once and share it across ranking + reasons.
    const wanted = buildWanted(profile!);
    ({ items, page, totalPages } = paginate(rankForYouWith(filtered, wanted, behavior), sp, filters.pageSize));
    reasons = forYouReasons(items, wanted, behavior);
  } else {
    const ordered = reorderForPlan(filtered, plan);
    // Map + calendar show the full filtered set (no pagination); grid paginates.
    ({ items, page, totalPages } =
      filters.view === "map" || filters.view === "calendar"
        ? { items: ordered, page: 1, totalPages: 1 }
        : paginate(ordered, sp, filters.pageSize));
  }

  return (
    <ExploreResults
      listings={items}
      view={filters.view}
      forYouLocked={forYouLocked}
      reasons={reasons}
      page={page}
      totalPages={totalPages}
      searchParams={sp}
      basePath="/explore"
    />
  );
}
