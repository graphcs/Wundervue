import { notFound } from "next/navigation";
import { getListingBySlug } from "@/lib/data/listings";
import { DetailPanel } from "@/components/detail/DetailPanel";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function InterceptedDealPanel({ params }: PageProps) {
  const { slug } = await params;
  const listing = getListingBySlug(slug);
  if (!listing || listing.type === "event") notFound();
  return <DetailPanel listing={listing} />;
}
