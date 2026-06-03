"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useFolders, FolderInsiderError } from "@/lib/hooks/useFolders";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Listing, ListingType, ListingSource, LifestyleTag } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { FreeBadge } from "@/components/ui/FreeBadge";
import { DealTag } from "@/components/ui/DealTag";
import { SlideOver } from "./SlideOver";

interface DbListingRow {
  id: string;
  slug: string;
  type: string;
  title: string;
  description: string;
  venue_id: string | null;
  address: string | null;
  neighborhood: string | null;
  category: string | null;
  date_start: string | null;
  date_end: string | null;
  date_display: string | null;
  time_display: string | null;
  is_free: boolean;
  deal_value: string | null;
  image_url: string | null;
  source: string;
  source_url: string | null;
  tags: string[];
}

const LISTING_COLUMNS =
  "id, slug, type, title, description, venue_id, address, neighborhood, category, date_start, date_end, date_display, time_display, is_free, deal_value, image_url, source, source_url, tags";

function rowToListing(row: DbListingRow): Listing {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type as ListingType,
    title: row.title,
    description: row.description,
    venueId: row.venue_id ?? "",
    venueName: "",
    address: row.address ?? "",
    neighborhood: row.neighborhood ?? "",
    category: row.category ?? "",
    startAt: row.date_start ?? "",
    endAt: row.date_end,
    dateDisplay: row.date_display ?? "",
    timeDisplay: row.time_display ?? "",
    isFree: row.is_free,
    dealValue: row.deal_value ?? undefined,
    imageUrl: row.image_url ?? "",
    source: row.source as ListingSource,
    sourceUrl: row.source_url ?? undefined,
    tags: (row.tags ?? []) as LifestyleTag[],
    lat: null,
    lng: null,
  };
}

function HeartIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="#ff535b"
      stroke="#ff535b"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

type SavedTab = "upcoming" | "past";
type SavedTypeFilter = "all" | "events" | "deals";

const TYPE_FILTERS: Array<{ id: SavedTypeFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "events", label: "Events" },
  { id: "deals", label: "Deals" },
];

export function SavedEventsPanel() {
  const { savedEventsOpen, closeSavedEvents, profile, session, openUpgrade } = useAuthContext();
  const { favorites, toggle } = useFavorites();
  const { folders, create, remove, canCreateMore, isInsider } = useFolders();
  const userId = session?.userId ?? null;
  const [saved, setSaved] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<SavedTab>("upcoming");
  const [typeFilter, setTypeFilter] = useState<SavedTypeFilter>("all");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  // listing id → folder id (or null when unfiled)
  const [assignments, setAssignments] = useState<Map<string, string | null>>(new Map());
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savesShareSlug, setSavesShareSlug] = useState<string | null>(null);
  const favIds = Array.from(favorites);
  const favKey = favIds.sort().join(",");

  // Load the user's revocable "all saves" share slug when the panel opens.
  useEffect(() => {
    if (!savedEventsOpen || !userId) {
      setSavesShareSlug(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from("profiles")
        .select("saves_share_slug")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      setSavesShareSlug((data as { saves_share_slug: string | null } | null)?.saves_share_slug ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [savedEventsOpen, userId]);

  async function mintSavesShare() {
    if (!userId) return;
    const slug = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("profiles")
      .update({ saves_share_slug: slug })
      .eq("user_id", userId);
    if (error) {
      console.error("[SavedEventsPanel] mint saves share failed", error);
      return;
    }
    setSavesShareSlug(slug);
  }

  async function stopSavesShare() {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("profiles")
      .update({ saves_share_slug: null })
      .eq("user_id", userId);
    if (error) {
      console.error("[SavedEventsPanel] revoke saves share failed", error);
      return;
    }
    setSavesShareSlug(null);
  }

  // Load folder assignments for the user's favorites when the panel opens.
  useEffect(() => {
    if (!savedEventsOpen || !userId) {
      setAssignments(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from("favorites")
        .select("listing_id, folder_id")
        .eq("user_id", userId);
      if (cancelled) return;
      const map = new Map<string, string | null>();
      for (const r of (data ?? []) as Array<{ listing_id: string; folder_id: string | null }>) {
        map.set(r.listing_id, r.folder_id);
      }
      setAssignments(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [savedEventsOpen, userId, favKey]);

  async function assignToFolder(listingId: string, folderId: string | null) {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    setAssignments((prev) => new Map(prev).set(listingId, folderId));
    const { error } = await supabase
      .from("favorites")
      .update({ folder_id: folderId })
      .eq("user_id", userId)
      .eq("listing_id", listingId);
    if (error) console.error("[SavedEventsPanel] assign failed", error);
  }

  async function handleDeleteFolder(id: string) {
    if (!window.confirm("Delete this folder? Its saved items become unfiled.")) return;
    try {
      await remove(id);
      // Detach locally so filtered views update without a refetch.
      setAssignments((prev) => {
        const next = new Map(prev);
        for (const [k, v] of next) if (v === id) next.set(k, null);
        return next;
      });
      if (activeFolder === id) setActiveFolder(null);
    } catch (err) {
      console.error("[SavedEventsPanel] delete folder failed", err);
    }
  }

  function startCreating() {
    if (!canCreateMore) {
      openUpgrade();
      return;
    }
    setNewName("");
    setCreating(true);
  }

  async function submitNewFolder() {
    const name = newName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const folder = await create(name);
      setActiveFolder(folder.id);
      setCreating(false);
      setNewName("");
    } catch (err) {
      if (err instanceof FolderInsiderError) openUpgrade();
      else console.error("[SavedEventsPanel] create folder failed", err);
    } finally {
      setSaving(false);
    }
  }

  // If the selected folder is deleted (here or elsewhere), fall back to All saves.
  useEffect(() => {
    if (activeFolder && !folders.some((f) => f.id === activeFolder)) setActiveFolder(null);
  }, [folders, activeFolder]);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const activeFolderObj = folders.find((f) => f.id === activeFolder) ?? null;
  // A folder shares by its random slug. "All saves" shares via a revocable
  // profile slug (Insider only) the owner mints/clears — never the user id.
  const folderShareUrl = activeFolderObj ? `${origin}/folders/${activeFolderObj.shareSlug}` : null;
  const canShareAllSaves = activeFolder === null && isInsider && !!userId;
  const allSavesUrl = savesShareSlug ? `${origin}/saves/${savesShareSlug}` : null;

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  useEffect(() => {
    if (!savedEventsOpen || favIds.length === 0) {
      setSaved([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("listings")
        .select(LISTING_COLUMNS)
        .in("id", favIds);
      if (cancelled) return;
      if (error) {
        console.error("[SavedEventsPanel] fetch failed", error);
        setSaved([]);
      } else {
        setSaved((data as DbListingRow[]).map(rowToListing));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // favKey collapses the favorites Set into a stable dep so we don't
    // re-fetch on every render — only when the actual id list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedEventsOpen, favKey]);

  // A saved listing is "past" once its effective end is before today.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const cutoff = todayStart.getTime();
  const isPast = (l: Listing) => {
    const end = l.endAt ?? l.startAt;
    if (!end) return false;
    const t = Date.parse(end);
    return !Number.isNaN(t) && t < cutoff;
  };
  const typeMatch = (l: Listing) =>
    typeFilter === "all"
      ? true
      : typeFilter === "events"
        ? l.type === "event" || l.type === "both"
        : l.type === "deal" || l.type === "both";

  const folderMatch = (l: Listing) =>
    activeFolder === null ? true : (assignments.get(l.id) ?? null) === activeFolder;
  const upcoming = saved.filter((l) => !isPast(l) && typeMatch(l) && folderMatch(l));
  const past = saved.filter((l) => isPast(l) && typeMatch(l) && folderMatch(l));
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <SlideOver
      open={savedEventsOpen}
      onClose={closeSavedEvents}
      title="Saved Events"
      subtitle={`${saved.length} ${saved.length === 1 ? "item" : "items"}`}
    >
      <div className="border-border flex gap-1 border-b px-5">
        {(["upcoming", "past"] as const).map((t) => {
          const active = t === tab;
          const count = t === "upcoming" ? upcoming.length : past.length;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative -mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                active ? "border-dark text-dark" : "text-graphite hover:text-dark border-transparent"
              }`}
            >
              {t === "upcoming" ? "Upcoming" : "Past"}
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${active ? "bg-dark text-white" : "bg-tag-bg text-gray"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-border flex gap-1.5 border-b px-5 py-2.5">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTypeFilter(f.id)}
            className={`rounded-pill border px-3 py-1 text-[12px] font-medium transition-colors ${
              typeFilter === f.id ? "bg-dark border-dark text-white" : "border-border text-graphite hover:border-dark"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="border-border flex flex-wrap items-center gap-1.5 border-b px-5 py-2.5">
        <button
          type="button"
          onClick={() => setActiveFolder(null)}
          className={`rounded-pill border px-3 py-1 text-[12px] font-medium transition-colors ${
            activeFolder === null ? "bg-dark border-dark text-white" : "border-border text-graphite hover:border-dark"
          }`}
        >
          All saves
        </button>
        {folders.map((f) => {
          const active = activeFolder === f.id;
          return (
            <span
              key={f.id}
              className={`inline-flex items-center gap-1.5 rounded-pill border py-1 pl-3 pr-2 text-[12px] font-medium transition-colors ${
                active ? "bg-dark border-dark text-white" : "border-border text-graphite"
              }`}
            >
              <button type="button" onClick={() => setActiveFolder(f.id)}>
                {f.name}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteFolder(f.id)}
                aria-label={`Delete folder ${f.name}`}
                title="Delete folder"
                className={active ? "text-white/60 hover:text-white" : "text-chrome hover:text-coral"}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          );
        })}
        {creating ? (
          <span className="inline-flex items-center gap-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewFolder();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="Folder name…"
              maxLength={40}
              className="border-border focus:border-dark rounded-pill w-[140px] border bg-white px-3 py-1 text-[12px] focus:outline-none"
            />
            <button
              type="button"
              onClick={submitNewFolder}
              disabled={!newName.trim() || saving}
              className="bg-dark rounded-pill px-3 py-1 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              aria-label="Cancel"
              className="text-gray hover:text-dark flex h-6 w-6 items-center justify-center rounded-full"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={startCreating}
            className="text-coral border-coral/50 hover:bg-coral/5 inline-flex items-center gap-1 rounded-pill border border-dashed px-3 py-1 text-[12px] font-medium"
            title={isInsider ? "Create a folder" : "Saved folders are an Insider feature"}
          >
            {!isInsider && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
            New folder{!isInsider && " · Insider"}
          </button>
        )}
      </div>

      {folderShareUrl && (
        <div className="border-border bg-tag-bg/40 flex items-center gap-2 border-b px-5 py-2.5">
          <span className="text-gray shrink-0 text-[11px] font-medium uppercase tracking-wide">Share</span>
          <input
            readOnly
            value={folderShareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="border-border text-graphite min-w-0 flex-1 rounded-md border bg-white px-2 py-1 text-[12px]"
          />
          <button
            type="button"
            onClick={() => copy(folderShareUrl)}
            className="bg-dark rounded-pill shrink-0 px-3 py-1 text-[12px] font-medium text-white hover:opacity-90"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {!folderShareUrl && canShareAllSaves && (
        <div className="border-border bg-tag-bg/40 flex items-center gap-2 border-b px-5 py-2.5">
          <span className="text-gray shrink-0 text-[11px] font-medium uppercase tracking-wide">Share</span>
          {allSavesUrl ? (
            <>
              <input
                readOnly
                value={allSavesUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="border-border text-graphite min-w-0 flex-1 rounded-md border bg-white px-2 py-1 text-[12px]"
              />
              <button
                type="button"
                onClick={() => copy(allSavesUrl)}
                className="bg-dark rounded-pill shrink-0 px-3 py-1 text-[12px] font-medium text-white hover:opacity-90"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={stopSavesShare}
                title="Revoke this link"
                className="text-gray hover:text-coral shrink-0 text-[12px] font-medium"
              >
                Stop
              </button>
            </>
          ) : (
            <>
              <span className="text-gray min-w-0 flex-1 truncate text-[12px]">
                Create a shareable link to all your saves.
              </span>
              <button
                type="button"
                onClick={mintSavesShare}
                className="bg-dark rounded-pill shrink-0 px-3 py-1 text-[12px] font-medium text-white hover:opacity-90"
              >
                Create link
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-gray flex items-center justify-center px-6 py-20 text-[13px]">
          Loading saved events…
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <div className="bg-tag-bg flex h-14 w-14 items-center justify-center rounded-full">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#86898a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h3 className="text-dark text-[15px] font-medium">
            {tab === "past" ? "No past saved items" : "No saved events yet"}
          </h3>
          <p className="text-gray max-w-[260px] text-[13px]">
            {tab === "past"
              ? "Events and deals you saved will move here once they've passed."
              : "Tap the heart on any event or deal to save it here for later."}
          </p>
          {tab === "upcoming" && (
            <Link
              href="/explore"
              onClick={closeSavedEvents}
              className="bg-dark rounded-pill mt-2 px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
            >
              Browse Events
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {list.map((l) => {
            const href = l.type === "deal" ? `/deals/${l.slug}` : `/events/${l.slug}`;
            const pastItem = tab === "past";
            return (
              <li key={l.id} className={`flex gap-3 px-5 py-3 ${pastItem ? "opacity-70" : ""}`}>
                <Link href={href} onClick={closeSavedEvents} className="group flex flex-1 gap-3">
                  <div className="bg-tag-bg relative h-[80px] w-[100px] shrink-0 overflow-hidden rounded-md">
                    <Badge type={l.type} size="sm" />
                    {l.isFree && <FreeBadge size="sm" />}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.imageUrl} alt={l.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap gap-1">
                      <span className="bg-tag-bg text-graphite rounded-full px-2 py-0.5 text-[10px] font-medium">
                        {l.neighborhood}
                      </span>
                      {l.dealValue && <DealTag value={l.dealValue} />}
                    </div>
                    <h3 className="text-dark line-clamp-2 text-[13px] font-medium leading-tight">{l.title}</h3>
                    <p className="text-gray text-[11px]">
                      {l.dateDisplay} · {l.venueName}
                    </p>
                  </div>
                </Link>
                <div className="flex shrink-0 flex-col items-end justify-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Remove from saved"
                    onClick={() => toggle(l.id, { plan: profile?.plan })}
                    className="hover:bg-tag-bg flex h-8 w-8 items-center justify-center self-end rounded-full transition-colors"
                  >
                    <HeartIcon />
                  </button>
                  {folders.length > 0 && (
                    <select
                      aria-label="Move to folder"
                      value={assignments.get(l.id) ?? ""}
                      onChange={(e) => assignToFolder(l.id, e.target.value || null)}
                      className="border-border text-graphite max-w-[110px] rounded-md border bg-white px-1.5 py-1 text-[11px] focus:border-dark focus:outline-none"
                    >
                      <option value="">Unfiled</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SlideOver>
  );
}
