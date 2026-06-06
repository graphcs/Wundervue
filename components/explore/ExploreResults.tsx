import type { Filters, Listing } from "@/lib/types";
import { ListingGrid } from "./ListingGrid";
import { MapView } from "./MapView";
import { CalendarView } from "./CalendarView";
import { ForYouLocked } from "./ForYouLocked";
import { Pagination } from "./Pagination";
import { PerPagePicker } from "./PerPagePicker";

interface Props {
  listings: Listing[];
  view: Filters["view"];
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
  forYouLocked?: boolean;
  reasons?: Record<string, string>;
}

export function ExploreResults({
  listings,
  view,
  page,
  totalPages,
  searchParams,
  basePath,
  forYouLocked = false,
  reasons,
}: Props) {
  if (view === "map") return <MapView listings={listings} />;
  if (view === "calendar") return <CalendarView listings={listings} />;
  if (view === "for-you" && forYouLocked) return <ForYouLocked />;
  // For You (unlocked) and grid both render the paginated grid below.
  return (
    <>
      <ListingGrid listings={listings} reasons={reasons} />
      <div className="mt-8 grid grid-cols-3 items-center">
        <div />
        <div className="flex justify-center">
          {totalPages > 1 ? (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              searchParams={searchParams}
              basePath={basePath}
            />
          ) : null}
        </div>
        <div className="flex justify-end">
          <PerPagePicker />
        </div>
      </div>
    </>
  );
}
