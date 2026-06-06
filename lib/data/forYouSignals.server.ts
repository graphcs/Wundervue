import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Behavioral signals for the For You feed: what the current user has saved and
// which venues they follow. RLS scopes both tables to the caller's own rows.
export interface ForYouSignals {
  savedIds: Set<string>; // listing ids the user already saved (excluded from the feed)
  followedVenues: Set<string>; // venue slugs the user follows (boosted)
}

const EMPTY: ForYouSignals = { savedIds: new Set(), followedVenues: new Set() };

export async function getForYouSignals(): Promise<ForYouSignals> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return EMPTY;
    const [fav, fol] = await Promise.all([
      supabase.from("favorites").select("listing_id"),
      supabase.from("venue_follows").select("venue_slug"),
    ]);
    return {
      savedIds: new Set((fav.data ?? []).map((r) => (r as { listing_id: string }).listing_id)),
      followedVenues: new Set((fol.data ?? []).map((r) => (r as { venue_slug: string }).venue_slug)),
    };
  } catch {
    return EMPTY;
  }
}
