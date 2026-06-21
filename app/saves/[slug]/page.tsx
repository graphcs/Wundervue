import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedSaves } from "@/lib/data/folders.server";
import { ListingGrid } from "@/components/explore/ListingGrid";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const shared = await getSharedSaves(slug);
  if (!shared) return { title: "Saved events" };
  return {
    title: `${shared.name} — Wundervue`,
    description: `A shared collection of ${shared.listings.length} Denver events & deals.`,
  };
}

export default async function SharedSavesPage({ params }: PageProps) {
  const { slug } = await params;
  const shared = await getSharedSaves(slug);
  if (!shared) notFound();

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-7 py-8">
      <header className="mb-6">
        <p className="text-coral text-[12px] font-semibold uppercase tracking-wider">Shared Saves</p>
        <h1 className="text-dark mt-1 text-[28px] font-medium leading-tight">{shared.name}</h1>
        <p className="text-gray mt-1 text-[14px]">
          {shared.listings.length} {shared.listings.length === 1 ? "item" : "items"} · curated on Wundervue
        </p>
      </header>

      <ListingGrid listings={shared.listings} />

      <div className="border-border mt-8 flex justify-center border-t pt-6">
        <Link href="/explore" className="bg-dark rounded-pill px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90">
          Discover more on Wundervue
        </Link>
      </div>
    </div>
  );
}
