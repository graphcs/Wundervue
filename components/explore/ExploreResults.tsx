import type { Filters, Listing } from "@/lib/types";
import { ListingGrid } from "./ListingGrid";
import { MapView } from "./MapView";
import { Pagination } from "./Pagination";

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
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        searchParams={searchParams}
        basePath={basePath}
      />
    </>
  );
}
