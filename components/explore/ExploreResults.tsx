import type { Filters, Listing } from "@/lib/types";
import { ListingGrid } from "./ListingGrid";
import { MapView } from "./MapView";

interface Props {
  listings: Listing[];
  view: Filters["view"];
}

export function ExploreResults({ listings, view }: Props) {
  if (view === "map") return <MapView listings={listings} />;
  return <ListingGrid listings={listings} />;
}
