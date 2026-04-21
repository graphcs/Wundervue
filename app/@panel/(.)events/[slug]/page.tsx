import { notFound } from "next/navigation";
import { getListingBySlug } from "@/lib/data/listings";
import { DetailPanel } from "@/components/detail/DetailPanel";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function InterceptedEventPanel({ params }: PageProps) {
  const { slug } = await params;
  const listing = getListingBySlug(slug);
  if (!listing || listing.type === "deal") notFound();
  return <DetailPanel listing={listing} />;
}
