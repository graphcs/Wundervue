import { notFound } from "next/navigation";
import { getListingBySlugAsync } from "@/lib/data/listings.server";
import { DetailPanel } from "@/components/detail/DetailPanel";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function InterceptedEventPanel({ params }: PageProps) {
  const { slug } = await params;
  const listing = await getListingBySlugAsync(slug);
  if (!listing || listing.type === "deal") notFound();
  return <DetailPanel listing={listing} />;
}
