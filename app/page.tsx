import type { Metadata } from "next";
import type { Filters } from "@/lib/types";
import { getMergedListings } from "@/lib/data/listings.server";
import { applyFilters } from "@/lib/filters/applyFilters";
import { parseSearchParams } from "@/lib/filters/parseSearchParams";
import { paginate } from "@/lib/filters/paginate";
import { reorderForPlan } from "@/lib/auth/insiderGate";
import { getServerProfile } from "@/lib/auth/serverPlan";
import { getForYouSignals } from "@/lib/data/forYouSignals.server";
import { rankForYouWith, forYouReasons, buildForYouBehavior } from "@/lib/data/recommendations";
import { buildWanted } from "@/lib/data/profileTaxonomy";
import { ExploreResults } from "@/components/explore/ExploreResults";
import { DiscoveryBar } from "@/components/explore/DiscoveryBar";
import { ensureDynamicCities } from "@/lib/data/dynamicCities.server";
import { HomeHero } from "@/components/home/HomeHero";
import { FeedTabs } from "@/components/home/FeedTabs";
import { MyEvents } from "@/components/home/MyEvents";

export const metadata: Metadata = {
  title: "Wundervue — Discover Denver Events & Deals",
  description:
    "Search and discover every event, deal, and thing to do in Denver. Filter by neighborhood, category, or lifestyle, and save your favorites.",
};

type SP = Record<string, string | string[] | undefined>;
interface PageProps {
  searchParams: Promise<SP>;
}

export default async function Home({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseSearchParams(sp);

  const isMyEvents = filters.tab === "my-events";
  const dynamicCities = await ensureDynamicCities();

  return (
    <>
      <HomeHero />
      <div className="mx-auto max-w-[1100px] px-4 sm:px-7 pt-6">
        <FeedTabs />
      </div>
      {/* My Events is client-only (favorites); All/For-You filter via DiscoveryBar. */}
      {!isMyEvents && (
        <DiscoveryBar showSearch={false} dynamicCities={dynamicCities} />
      )}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-7 py-8">
        {isMyEvents ? <MyEvents /> : <Feed sp={sp} filters={filters} />}
      </div>
    </>
  );
}

// Server-rendered All / For-You feed (My Events is client-only, above).
async function Feed({ sp, filters }: { sp: SP; filters: Filters }) {
  const forYou = filters.tab === "for-you";
  // Fetch For-You signals in parallel, but only on the For-You tab (the All tab
  // shouldn't pay for a favorites/follows query it never uses).
  const [all, profile, signals] = await Promise.all([
    getMergedListings(),
    getServerProfile(),
    forYou ? getForYouSignals() : Promise.resolve(null),
  ]);
  const plan = profile?.plan ?? null;
  const filtered = applyFilters(all, filters);

  // For You is Insider-only; free/guests get the upgrade prompt.
  const forYouLocked = forYou && (plan !== "insider" || !profile);

  let items: typeof filtered;
  let page = 1;
  let totalPages = 1;
  let reasons: Record<string, string> | undefined;

  if (forYouLocked) {
    items = [];
  } else if (forYou) {
    // Behavioral signals filters can't express: followed venues + learned taste
    // from past saves; already-saved listings are dropped.
    const behavior = buildForYouBehavior(signals!, all);
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
      basePath="/"
    />
  );
}
