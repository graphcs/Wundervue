"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// folder id → set of listing ids in it (folder_items membership). Shared by the
// account Saved tab (filter) and the saved-events panel (assignment), so the
// query + shape live in one place. Returns [membership, setMembership] so a
// caller can apply optimistic edits.
export function useFolderMembership(
  folderIds: string[],
): [Map<string, Set<string>>, Dispatch<SetStateAction<Map<string, Set<string>>>>] {
  const [membership, setMembership] = useState<Map<string, Set<string>>>(new Map());
  const key = folderIds.slice().sort().join(",");

  useEffect(() => {
    if (folderIds.length === 0) {
      setMembership(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await getSupabaseBrowserClient()
        .from("folder_items")
        .select("folder_id, listing_id")
        .in("folder_id", folderIds);
      if (cancelled) return;
      const m = new Map<string, Set<string>>();
      for (const r of (data ?? []) as Array<{ folder_id: string; listing_id: string }>) {
        (m.get(r.folder_id) ?? m.set(r.folder_id, new Set()).get(r.folder_id)!).add(r.listing_id);
      }
      setMembership(m);
    })();
    return () => {
      cancelled = true;
    };
    // key is the order-independent digest of folderIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [membership, setMembership];
}
