import { notFound } from "next/navigation";
import { getListingBySlugAsync, getVenueTicketUrl } from "@/lib/data/listings.server";
import { DetailPanel } from "@/components/detail/DetailPanel";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function InterceptedDealPanel({ params }: PageProps) {
  const { slug } = await params;
  const listing = await getListingBySlugAsync(slug);
  if (!listing || listing.type === "event") notFound();
  const venueTicketUrl = await getVenueTicketUrl(listing);
  return <DetailPanel listing={listing} venueTicketUrl={venueTicketUrl} />;
}
