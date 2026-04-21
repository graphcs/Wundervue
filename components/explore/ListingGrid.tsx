import type { Listing } from "@/lib/types";
import { ListingCard } from "./ListingCard";
import { EmptyState } from "./EmptyState";

interface Props {
  listings: Listing[];
}

export function ListingGrid({ listings }: Props) {
  if (listings.length === 0) return <EmptyState />;
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
