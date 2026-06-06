import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Listing, ListingSource, ListingType, LifestyleTag } from "@/lib/types";

export interface SharedFolder {
  id: string;
  ownerId: string;
  name: string;
  kind: "basic" | "advanced";
  listings: Listing[];
}

const LISTING_COLUMNS =
  "id, slug, type, title, description, venue_id, address, neighborhood, category, date_start, date_end, date_display, time_display, is_free, deal_value, image_url, source, source_url, tags";

interface DbListingRow {
  id: string; slug: string; type: string; title: string; description: string;
  venue_id: string | null; address: string | null; neighborhood: string | null;
  category: string | null; date_start: string | null; date_end: string | null;
  date_display: string | null; time_display: string | null; is_free: boolean;
  deal_value: string | null; image_url: string | null; source: string;
  source_url: string | null; tags: string[];
}

function rowToListing(r: DbListingRow, venueNames: Map<string, string>): Listing {
  return {
    id: r.id, slug: r.slug, type: r.type as ListingType, title: r.title,
    description: r.description, venueId: r.venue_id ?? "",
    venueName: r.venue_id ? (venueNames.get(r.venue_id) ?? "") : "",
    address: r.address ?? "", neighborhood: r.neighborhood ?? "", category: r.category ?? "",
    startAt: r.date_start ?? "", endAt: r.date_end, dateDisplay: r.date_display ?? "",
    timeDisplay: r.time_display ?? "", isFree: r.is_free, dealValue: r.deal_value ?? undefined,
    imageUrl: r.image_url ?? "", source: r.source as ListingSource,
    sourceUrl: r.source_url ?? undefined, tags: (r.tags ?? []) as LifestyleTag[],
    lat: null, lng: null,
  };
}

// Resolve a set of listing ids to published Listings (service role), attaching
// venue names. Shared by both share readers.
async function loadListingsForIds(admin: SupabaseClient, ids: string[]): Promise<Listing[]> {
  if (ids.length === 0) return [];
  const [{ data: rows }, { data: venues }] = await Promise.all([
    admin.from("listings").select(LISTING_COLUMNS).in("id", ids).not("published_at", "is", null),
    admin.from("venues").select("id, name"),
  ]);
  const venueNames = new Map<string, string>();
  for (const v of (venues ?? []) as Array<{ id: string; name: string }>) venueNames.set(v.id, v.name);
  return ((rows ?? []) as DbListingRow[]).map((r) => rowToListing(r, venueNames));
}

// Whether the signed-in user may edit this folder (owner or collaborator). Used
// by the shared-folder page to decide between the editor and the read-only grid.
export async function canEditFolder(folderId: string, ownerId: string): Promise<boolean> {
  if (!folderId) return false;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  if (user.id === ownerId) return true;
  const { data } = await supabase
    .from("folder_collaborators")
    .select("user_id")
    .eq("folder_id", folderId)
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data;
}

// Read a user's entire saved set as a shareable collection, resolved by a
// revocable share slug (profiles.saves_share_slug) — NOT the user id. The owner
// mints the slug when they choose to share and can clear it to revoke. The
// service role bypasses the owner-only RLS on favorites. Returns null when the
// slug is unknown (never shared / revoked), which the page renders as 404.
export async function getSharedSaves(shareSlug: string): Promise<SharedFolder | null> {
  if (!shareSlug) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error("[folders] SUPABASE_SERVICE_ROLE_KEY not set");
    return null;
  }
  try {
    const admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });

    const { data: prof } = await admin
      .from("profiles")
      .select("user_id, name")
      .eq("saves_share_slug", shareSlug)
      .maybeSingle();
    if (!prof) return null;
    const userId = (prof as { user_id: string }).user_id;
    const name = (prof as { name: string | null }).name?.trim() || "Saved events";

    // The "all saves" share is the owner's full saved set — view-only, not an
    // editable folder, so it carries no folder id.
    const base = { id: "", ownerId: userId, name: `${name}'s saves`, kind: "basic" as const };

    const { data: favRows } = await admin.from("favorites").select("listing_id").eq("user_id", userId);
    const ids = (favRows ?? []).map((r) => (r as { listing_id: string }).listing_id);
    return { ...base, listings: await loadListingsForIds(admin, ids) };
  } catch (err) {
    console.error("[folders] getSharedSaves failed", err);
    return null;
  }
}

// Read a publicly-shared folder by its share slug, using the service role so
// anyone with the link can view it regardless of who owns it (favorites/folders
// are otherwise owner-only under RLS). Returns null when the slug is unknown.
export async function getSharedFolder(shareSlug: string): Promise<SharedFolder | null> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error("[folders] SUPABASE_SERVICE_ROLE_KEY not set");
    return null;
  }
  try {
    const admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });

    const { data: folder } = await admin
      .from("saved_folders")
      .select("id, user_id, name, kind")
      .eq("share_slug", shareSlug)
      .maybeSingle();
    if (!folder) return null;
    const f = folder as { id: string; user_id: string; name: string; kind: "basic" | "advanced" };
    const base = { id: f.id, ownerId: f.user_id, name: f.name, kind: f.kind };

    // Membership lives in folder_items (owner + collaborators), not favorites.
    const { data: itemRows } = await admin
      .from("folder_items")
      .select("listing_id")
      .eq("folder_id", f.id);
    const ids = (itemRows ?? []).map((r) => (r as { listing_id: string }).listing_id);
    return { ...base, listings: await loadListingsForIds(admin, ids) };
  } catch (err) {
    console.error("[folders] getSharedFolder failed", err);
    return null;
  }
}
