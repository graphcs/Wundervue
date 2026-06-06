import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedFolder, canEditFolder } from "@/lib/data/folders.server";
import { ListingGrid } from "@/components/explore/ListingGrid";
import { FolderEditor } from "@/components/folders/FolderEditor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ share_slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { share_slug } = await params;
  const folder = await getSharedFolder(share_slug);
  if (!folder) return { title: "Folder not found" };
  return {
    title: `${folder.name} — a Wundervue collection`,
    description: `A shared collection of ${folder.listings.length} Denver events & deals.`,
  };
}

export default async function SharedFolderPage({ params }: PageProps) {
  const { share_slug } = await params;
  const folder = await getSharedFolder(share_slug);
  if (!folder) notFound();

  // Editable for the owner or a collaborator (real folders only, not the
  // "all saves" share which has no folder id).
  const canEdit = await canEditFolder(folder.id, folder.ownerId);

  return (
    <div className="mx-auto max-w-[1100px] px-7 py-8">
      <header className="mb-6">
        <p className="text-coral text-[12px] font-semibold uppercase tracking-wider">
          Shared Collection
        </p>
        <h1 className="text-dark mt-1 text-[28px] font-medium leading-tight">{folder.name}</h1>
        <p className="text-gray mt-1 text-[14px]">
          {folder.listings.length} {folder.listings.length === 1 ? "item" : "items"} · curated on Wundervue
        </p>
      </header>

      {canEdit ? (
        <FolderEditor folderId={folder.id} initialListings={folder.listings} />
      ) : (
        <ListingGrid listings={folder.listings} />
      )}

      <div className="border-border mt-8 flex justify-center border-t pt-6">
        <Link
          href="/explore"
          className="bg-dark rounded-pill px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
        >
          Discover more on Wundervue
        </Link>
      </div>
    </div>
  );
}
