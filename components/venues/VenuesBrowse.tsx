import Link from "next/link";
import {
  getBrowseVenues,
  getVenueImageMapBySlug,
} from "@/lib/data/listings.server";
import { getForYouSignals } from "@/lib/data/forYouSignals.server";
import { venueCategoryLabel } from "@/lib/data/categories";
import { locationMatchesSelection } from "@/lib/data/locations";
import type { DynamicCity } from "@/lib/data/locations";
import { first, csv } from "@/lib/filters/parseSearchParams";
import { getDateRange } from "@/lib/filters/applyFilters";
import { paginate } from "@/lib/filters/paginate";
import {
  buildVenuesHref,
  parseVenueDate,
  parseVenueLifestyle,
  parseVenueSort,
} from "@/lib/venues/browseParams";
import { Pagination } from "@/components/explore/Pagination";
import { PinIcon } from "@/components/detail/icons";
import { VenueFilterBar } from "@/components/venues/VenueFilterBar";

const PAGE_SIZE = 9;

type SearchParams = Record<string, string | string[] | undefined>;

interface Props {
  sp: SearchParams;
  /** Scope to the signed-in user's followed venues. */
  mine: boolean;
  /** Where filter/pagination links point ("/venues" or "/"). */
  basePath: string;
  /** Params every generated link must preserve (e.g. { tab: "my-venues" }). */
  sticky: Record<string, string>;
  /** Show the All / My Venues toggle (off when the context is inherently mine). */
  showMineToggle: boolean;
  /** When set, render a "Browse all venues" link (e.g. on the homepage tab,
   *  which has no toggle to reach the full venues page). */
  allVenuesHref?: string;
  dynamicCities: readonly DynamicCity[];
}

export async function VenuesBrowse({ sp, mine, basePath, sticky, showMineToggle, allVenuesHref, dynamicCities }: Props) {
  const q = (first(sp, "vq") ?? "").trim();
  const cats = csv(first(sp, "vcat"));
  const locs = csv(first(sp, "vloc"));
  const sort = parseVenueSort(first(sp, "vsort"));
  // "Has upcoming events" defaults on, so the All view matches its prior behavior;
  // users opt in to seeing quiet venues by turning it off.
  const hasUpcoming = first(sp, "vupcoming") !== "0";
  const date = parseVenueDate(first(sp, "vdate"));
  const from = first(sp, "vfrom");
  const to = first(sp, "vto");
  const lifestyle = parseVenueLifestyle(csv(first(sp, "vlife")));

  const [all, imageMap, signals] = await Promise.all([
    getBrowseVenues({ includeEmpty: true }),
    getVenueImageMapBySlug(),
    mine ? getForYouSignals() : Promise.resolve(null),
  ]);

  const scoped = mine ? all.filter((v) => signals?.followedVenues.has(v.slug)) : all;

  const catSet = new Set(cats);
  const locSet = new Set(locs);
  const tagSet = new Set<string>(lifestyle);
  const needle = q.toLowerCase();
  // The "time" filter reuses the explore feed's date logic, so a window here
  // means exactly what it does for events. null = no date constraint.
  const dateRange = getDateRange({ date, from, to });
  const filtered = scoped.filter((v) => {
    if (catSet.size && !v.categories.some((c) => catSet.has(c))) return false;
    if (locSet.size && !locationMatchesSelection(v.neighborhood, locSet)) return false;
    if (hasUpcoming && v.upcomingCount === 0) return false;
    if (needle && !`${v.name} ${v.neighborhood}`.toLowerCase().includes(needle)) return false;
    // Time + lifestyle both filter on the venue's upcoming events: keep the venue
    // only if one upcoming event satisfies every active constraint at once.
    if (dateRange || tagSet.size) {
      const hasMatch = v.upcoming.some((e) => {
        if (tagSet.size && !e.tags.some((t) => tagSet.has(t))) return false;
        if (dateRange) {
          if (!e.startAt) return false;
          const start = new Date(e.startAt);
          const end = e.endAt ? new Date(e.endAt) : start;
          if (!(end >= dateRange.start && start <= dateRange.end)) return false;
        }
        return true;
      });
      if (!hasMatch) return false;
    }
    return true;
  });

  const sorted =
    sort === "saved"
      ? [...filtered].sort((a, b) => b.saveCount - a.saveCount || a.name.localeCompare(b.name))
      : sort === "followed"
        ? [...filtered].sort((a, b) => b.followerCount - a.followerCount || a.name.localeCompare(b.name))
        : filtered; // getBrowseVenues already returns most-upcoming-first

  const { items, page, totalPages } = paginate(sorted, sp, PAGE_SIZE);

  // Link back to the unfiltered view of this same context (preserve sticky + mine).
  const clearHref = buildVenuesHref({
    basePath,
    sticky,
    showMineToggle,
    filters: { mine, q: "", cats: [], locs: [], sort: "upcoming", hasUpcoming: true, date: "any", lifestyle: [] },
  });

  return (
    <>
      <VenueFilterBar
        mine={mine}
        showMineToggle={showMineToggle}
        q={q}
        cats={cats}
        locs={locs}
        sort={sort}
        hasUpcoming={hasUpcoming}
        date={date}
        from={from}
        to={to}
        lifestyle={lifestyle}
        basePath={basePath}
        sticky={sticky}
        dynamicCities={dynamicCities}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-gray text-[13px]">
          {filtered.length} {filtered.length === 1 ? "venue" : "venues"}
          {mine ? " you follow" : ""}
          {q ? ` matching “${q}”` : ""}
        </p>
        {allVenuesHref && (
          <Link href={allVenuesHref} className="text-coral shrink-0 text-[13px] font-medium hover:underline">
            Browse all venues →
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        mine && (signals?.followedVenues.size ?? 0) === 0 ? (
          <div className="text-gray py-16 text-center text-[14px]">
            <p className="text-dark text-[16px] font-medium">You&apos;re not following any venues yet</p>
            <p className="mt-1">Follow places you love to keep up with their events.</p>
            <Link href="/venues" className="text-coral mt-2 inline-block font-medium hover:underline">
              Browse all venues
            </Link>
          </div>
        ) : (
          <p className="text-gray py-16 text-center text-[14px]">
            No venues found.{" "}
            <Link href={clearHref} className="text-coral font-medium hover:underline">
              Clear filters
            </Link>
          </p>
        )
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
                        <PinIcon size={11} />
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
          <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} basePath={basePath} />
        </div>
      )}
    </>
  );
}
