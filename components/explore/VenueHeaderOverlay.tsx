"use client";

import { useSearchParams } from "next/navigation";
import { getVenue } from "@/lib/data/venues";
import { VenueHeader } from "./VenueHeader";

export function VenueHeaderOverlay() {
  const sp = useSearchParams();
  const venueId = sp.get("venue");
  if (!venueId) return null;
  const venue = getVenue(venueId);
  if (!venue) return null;
  return <VenueHeader venue={venue} showClose />;
}
