"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  listing_id: string | null;
  read_at: string | null;
  created_at: string;
}

// In-app inbox state for the header bell. RLS scopes every query to the
// signed-in user's own rows, so we don't filter by user_id explicitly.
// Polls on mount + when the bell opens (caller calls refresh()); no realtime
// subscription yet — low-frequency notifications don't justify the connection
// overhead. Swap to a Supabase realtime channel here if that changes.
export function useNotifications() {
  const { isLoggedIn, session } = useAuthContext();
  const userId = session?.userId ?? null;
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data } = await getSupabaseBrowserClient()
      .from("notifications")
      .select("id, type, title, body, url, listing_id, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as NotificationRow[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const unread = items.reduce((n, x) => n + (x.read_at ? 0 : 1), 0);

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setItems((xs) => xs.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? now } : n)));
    await getSupabaseBrowserClient().from("notifications").update({ read_at: now }).eq("id", id).is("read_at", null);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((xs) => xs.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await getSupabaseBrowserClient().from("notifications").update({ read_at: now }).is("read_at", null);
  }, [userId]);

  const dismiss = useCallback(async (id: string) => {
    setItems((xs) => xs.filter((n) => n.id !== id));
    await getSupabaseBrowserClient().from("notifications").delete().eq("id", id);
  }, []);

  return { items, unread, loading, refresh, markRead, markAllRead, dismiss, isLoggedIn };
}
