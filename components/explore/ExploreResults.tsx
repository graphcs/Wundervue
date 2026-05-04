import type { Filters, Listing } from "@/lib/types";
import { ListingGrid } from "./ListingGrid";
import { MapView } from "./MapView";
import { Pagination } from "./Pagination";
import { PerPagePicker } from "./PerPagePicker";

interface Props {
  listings: Listing[];
  view: Filters["view"];
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
}

export function ExploreResults({
  listings,
  view,
  page,
  totalPages,
  searchParams,
  basePath,
}: Props) {
  if (view === "map") return <MapView listings={listings} />;
  return (
    <>
      <ListingGrid listings={listings} />
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
