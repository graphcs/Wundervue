"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";

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
      const shareSlug = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const { data, error } = await sb
        .from("saved_folders")
        .insert({ user_id: userId, name: name.trim(), kind, share_slug: shareSlug })
        .select("id, name, kind, share_slug")
        .single();
      if (error) throw error;
      await refresh();
      const row = data as { id: string; name: string; kind: "basic" | "advanced"; share_slug: string };
      return { id: row.id, name: row.name, kind: row.kind, shareSlug: row.share_slug };
    },
    [userId, isInsider, refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const sb = getSupabaseBrowserClient();
      // Detach any saved items first so they don't point at a dead folder.
      await sb.from("favorites").update({ folder_id: null }).eq("folder_id", id);
      const { error } = await sb.from("saved_folders").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return { folders, refresh, create, remove, isInsider, canCreateMore: isInsider };
}
