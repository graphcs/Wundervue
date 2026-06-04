"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { randomShareSlug } from "@/lib/shareSlug";

export interface Folder {
  id: string;
  name: string;
  kind: "basic" | "advanced";
  shareSlug: string;
}

// Product decision (overrides the sheet's "1 basic folder for free"): saved
// folders are an Insider-only feature. Free users cannot create any folder;
// Insiders get unlimited folders.
export class FolderInsiderError extends Error {
  constructor() {
    super("Saved folders are an Insider feature");
    this.name = "FolderInsiderError";
  }
}

export function useFolders() {
  const { session, profile } = useAuthContext();
  const userId = session?.userId ?? null;
  const isInsider = profile?.plan === "insider";
  const [folders, setFolders] = useState<Folder[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setFolders([]);
      return;
    }
    const sb = getSupabaseBrowserClient();
    const { data, error } = await sb
      .from("saved_folders")
      .select("id, name, kind, share_slug")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[useFolders] load failed", error);
      return;
    }
    setFolders(
      ((data ?? []) as Array<{ id: string; name: string; kind: "basic" | "advanced"; share_slug: string }>).map(
        (row) => ({ id: row.id, name: row.name, kind: row.kind, shareSlug: row.share_slug }),
      ),
    );
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (name: string, kind: "basic" | "advanced" = "basic"): Promise<Folder> => {
      if (!userId) throw new Error("Not signed in");
      if (!isInsider) throw new FolderInsiderError();
      const sb = getSupabaseBrowserClient();
      // share_slug has no DB default on the production table, so mint one here.
      const shareSlug = randomShareSlug();
      const { data, error } = await sb
        .from("saved_folders")
        .insert({ user_id: userId, name: name.trim(), kind, share_slug: shareSlug })
        .select("id, name, kind, share_slug")
        .single();
      if (error) {
        console.error("[useFolders] create failed", error.code, error.message, error.details);
        // Re-throw as a real Error so the message survives (Supabase's error
        // object renders as "{}" in the console/overlay).
        throw new Error(error.message || error.code || "Could not create folder");
      }
      const row = data as { id: string; name: string; kind: "basic" | "advanced"; share_slug: string };
      const folder: Folder = { id: row.id, name: row.name, kind: row.kind, shareSlug: row.share_slug };
      // Append to local state immediately so the folder shows in the chips and
      // every item's dropdown without waiting for a re-fetch.
      setFolders((prev) => [...prev, folder]);
      return folder;
    },
    [userId, isInsider],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      // Drop from local state immediately; re-sync from the server if the
      // delete fails.
      setFolders((prev) => prev.filter((f) => f.id !== id));
      const sb = getSupabaseBrowserClient();
      // Detach any saved items first so they don't point at a dead folder.
      await sb.from("favorites").update({ folder_id: null }).eq("folder_id", id);
      const { error } = await sb.from("saved_folders").delete().eq("id", id);
      if (error) {
        await refresh();
        throw error;
      }
    },
    [refresh],
  );

  return { folders, refresh, create, remove, isInsider, canCreateMore: isInsider };
}
