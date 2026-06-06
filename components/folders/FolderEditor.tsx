"use client";

import { useMemo, useState } from "react";
import type { Listing } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ListingCard } from "@/components/explore/ListingCard";
import { EmptyState } from "@/components/explore/EmptyState";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useSavedListings } from "@/lib/hooks/useSavedListings";

// Owner/collaborator editing surface for a shared folder. Membership lives in
// folder_items; RLS lets any editor insert/delete rows for this folder.
export function FolderEditor({
  folderId,
  initialListings,
}: {
  folderId: string;
  initialListings: Listing[];
}) {
  const { session } = useAuthContext();
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [adding, setAdding] = useState(false);
  const inFolder = useMemo(() => new Set(listings.map((l) => l.id)), [listings]);

  async function removeItem(id: string) {
    const prev = listings;
    setListings((p) => p.filter((l) => l.id !== id)); // optimistic
    const { error } = await getSupabaseBrowserClient()
      .from("folder_items")
      .delete()
      .eq("folder_id", folderId)
      .eq("listing_id", id);
    if (error) setListings(prev); // revert on failure
  }

  async function addItem(listing: Listing) {
    if (inFolder.has(listing.id)) return;
    setListings((p) => [...p, listing]); // optimistic
    const { error } = await getSupabaseBrowserClient()
      .from("folder_items")
      .insert({ folder_id: folderId, listing_id: listing.id, added_by: session?.userId ?? null });
    if (error) setListings((p) => p.filter((l) => l.id !== listing.id));
  }

  return (
    <>
      <div className="border-coral/40 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-coral/5 px-4 py-3">
        <span className="text-dark text-[13px] font-medium">✨ You can edit this collection</span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="bg-dark rounded-pill px-4 py-2 text-[12px] font-medium text-white hover:opacity-90"
        >
          {adding ? "Done" : "＋ Add from your saves"}
        </button>
      </div>

      {adding && <AddFromSaves inFolder={inFolder} onAdd={addItem} />}

      {listings.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              hideFav
              topRight={
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void removeItem(l.id);
                  }}
                  aria-label={`Remove ${l.title} from this collection`}
                  className="text-dark flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform hover:scale-110"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

// Pick from the editor's own saved events (not already in the folder).
function AddFromSaves({
  inFolder,
  onAdd,
}: {
  inFolder: Set<string>;
  onAdd: (l: Listing) => void;
}) {
  const { favorites } = useFavorites();
  const { listings, loading } = useSavedListings(Array.from(favorites));
  const [added, setAdded] = useState<Set<string>>(new Set());
  const candidates = listings.filter((l) => !inFolder.has(l.id));

  return (
    <div className="border-border mb-6 rounded-xl border bg-white p-4">
      <p className="text-dark mb-3 text-[14px] font-medium">Add from your saved events</p>
      {loading ? (
        <p className="text-gray text-[13px]">Loading…</p>
      ) : candidates.length === 0 ? (
        <p className="text-gray text-[13px]">No more saved events to add.</p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {candidates.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3">
              <span className="text-dark line-clamp-1 text-[13px]">{l.title}</span>
              <button
                type="button"
                disabled={added.has(l.id)}
                onClick={() => {
                  setAdded((p) => new Set(p).add(l.id));
                  onAdd(l);
                }}
                className="border-border hover:bg-tag-bg shrink-0 rounded-pill border px-3 py-1 text-[12px] font-medium disabled:opacity-40"
              >
                {added.has(l.id) ? "Added" : "Add"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
