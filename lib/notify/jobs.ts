import "server-only";
import { getServiceClient } from "@/lib/ingest/persist";
import { createNotifications, type NotificationInput } from "./index";
import { canReceive, type NotificationPrefs } from "./types";
import { listingMatchesProfile } from "./match";
import type { Plan } from "@/lib/auth/types";

// Shared per-user gating/matching context loaded once per run.
interface UserCtx {
  plan: Plan | null;
  prefs: NotificationPrefs;
  interests: string[];
  neighborhoods: string[];
  lifestyle: string[];
}

interface ListingRow {
  id: string;
  slug: string;
  title: string;
  neighborhood: string | null;
  category: string | null;
  tags: string[] | null;
  is_free: boolean | null;
  venue_id: string | null;
  date_start: string | null;
}

const LISTING_COLS =
  "id, slug, title, neighborhood, category, tags, is_free, venue_id, date_start";
const LISTING_LIMIT = 500;

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function dayKey(d: Date) {
  return `${monthKey(d)}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
// ISO 8601 week key (e.g. "2026-W23"); good enough for once-per-week dedupe.
function weekKey(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function loadUsers(): Promise<Map<string, UserCtx>> {
  const { data } = await getServiceClient()
    .from("profiles")
    .select("user_id, plan, notification_prefs, interests, neighborhoods, lifestyle");
  const map = new Map<string, UserCtx>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    map.set(r.user_id as string, {
      plan: (r.plan as Plan) ?? null,
      prefs: (r.notification_prefs as NotificationPrefs) ?? {},
      interests: (r.interests as string[]) ?? [],
      neighborhoods: (r.neighborhoods as string[]) ?? [],
      lifestyle: (r.lifestyle as string[]) ?? [],
    });
  }
  return map;
}

async function getWatermark(job: string, fallbackMs: number): Promise<string> {
  const { data } = await getServiceClient()
    .from("notification_job_state")
    .select("last_run_at")
    .eq("job", job)
    .maybeSingle();
  return (
    (data as { last_run_at: string } | null)?.last_run_at ??
    new Date(Date.now() - fallbackMs).toISOString()
  );
}

// Run a time-windowed job: read the watermark, do the work since then, advance
// the watermark to the run start (only after the work succeeds, so a failure
// re-processes the window rather than skipping it).
async function withWatermark(
  job: string,
  fallbackMs: number,
  fn: (since: string, runStartIso: string) => Promise<number>,
): Promise<number> {
  const runStart = new Date().toISOString();
  const since = await getWatermark(job, fallbackMs);
  const written = await fn(since, runStart);
  await getServiceClient().from("notification_job_state").upsert({ job, last_run_at: runStart });
  return written;
}

// Published, future listings inserted since `sinceIso` (excludes hidden dupes).
async function newUpcomingListings(sinceIso: string, nowIso: string): Promise<ListingRow[]> {
  const { data } = await getServiceClient()
    .from("listings")
    .select(LISTING_COLS)
    .gt("published_at", sinceIso)
    .gte("date_start", nowIso)
    .is("dedup_of", null)
    .not("published_at", "is", null)
    .limit(LISTING_LIMIT);
  const rows = (data ?? []) as ListingRow[];
  if (rows.length === LISTING_LIMIT) {
    console.warn(`[notifications] newUpcomingListings hit the ${LISTING_LIMIT} cap; some new listings skipped this run`);
  }
  return rows;
}

function toMatchListing(l: ListingRow) {
  return { category: l.category, neighborhood: l.neighborhood, tags: l.tags, isFree: l.is_free };
}

export interface JobResult {
  job: string;
  written: number;
}

// Basic, non-personalized: monthly summary of a user's own upcoming saved events.
export async function runMonthlyFavorites(now: Date): Promise<JobResult> {
  const sb = getServiceClient();
  const users = await loadUsers();
  const { data: favs } = await sb.from("favorites").select("user_id, listing_id");
  const favRows = (favs ?? []) as Array<{ user_id: string; listing_id: string }>;
  const ids = [...new Set(favRows.map((f) => f.listing_id))];
  if (ids.length === 0) return { job: "monthly-favorites", written: 0 };

  const { data: rows } = await sb
    .from("listings")
    .select("id, title")
    .in("id", ids)
    .gte("date_start", now.toISOString())
    .is("dedup_of", null)
    .not("published_at", "is", null);
  const upcoming = new Map((rows ?? []).map((r) => [(r as { id: string }).id, r as { id: string; title: string }]));

  const titlesByUser = new Map<string, string[]>();
  for (const f of favRows) {
    const l = upcoming.get(f.listing_id);
    if (!l) continue;
    (titlesByUser.get(f.user_id) ?? titlesByUser.set(f.user_id, []).get(f.user_id)!).push(l.title);
  }

  const key = monthKey(now);
  const batch: NotificationInput[] = [];
  for (const [userId, titles] of titlesByUser) {
    const ctx = users.get(userId);
    if (!ctx || !canReceive("monthly_favorites", ctx.plan, ctx.prefs)) continue;
    batch.push({
      userId,
      type: "monthly_favorites",
      title: `You have ${titles.length} saved ${titles.length === 1 ? "event" : "events"} coming up`,
      body: titles.slice(0, 3).join(" · "),
      url: "/account?tab=saved",
      dedupKey: `monthly_favorites:${key}`,
    });
  }
  return { job: "monthly-favorites", written: await createNotifications(batch) };
}

// Advanced (Insider): daily batched alert of new listings matching prefs.
export async function runNewDrops(now: Date): Promise<JobResult> {
  const written = await withWatermark("new_drops", 24 * 3600 * 1000, async (since, runStart) => {
    const listings = await newUpcomingListings(since, runStart);
    if (listings.length === 0) return 0;
    const users = await loadUsers();
    const key = dayKey(now);
    const batch: NotificationInput[] = [];
    for (const [userId, ctx] of users) {
      if (!canReceive("new_drops", ctx.plan, ctx.prefs)) continue;
      const matched = listings.filter((l) => listingMatchesProfile(toMatchListing(l), ctx));
      if (matched.length === 0) continue;
      batch.push({
        userId,
        type: "new_drops",
        title: `${matched.length} new ${matched.length === 1 ? "event" : "events"} you might like`,
        body: matched.slice(0, 3).map((l) => l.title).join(" · "),
        url: "/explore",
        data: { count: matched.length },
        dedupKey: `new_drops:${key}`,
      });
    }
    return createNotifications(batch);
  });
  return { job: "new-drops", written };
}

// Advanced (Insider): new listings at venues a user follows, one per listing.
export async function runVenueAlerts(now: Date): Promise<JobResult> {
  const sb = getServiceClient();
  const written = await withWatermark("venue_alerts", 24 * 3600 * 1000, async (since, runStart) => {
    const listings = (await newUpcomingListings(since, runStart)).filter((l) => l.venue_id);
    if (listings.length === 0) return 0;

    const venueIds = [...new Set(listings.map((l) => l.venue_id as string))];
    const { data: venues } = await sb.from("venues").select("id, slug, name").in("id", venueIds);
    const venueById = new Map(
      (venues ?? []).map((v) => [(v as { id: string }).id, v as { id: string; slug: string; name: string }]),
    );

    const slugs = [...new Set((venues ?? []).map((v) => (v as { slug: string }).slug))];
    const { data: follows } = await sb
      .from("venue_follows")
      .select("user_id, venue_slug")
      .in("venue_slug", slugs);
    const followersBySlug = new Map<string, string[]>();
    for (const f of (follows ?? []) as Array<{ user_id: string; venue_slug: string }>) {
      (followersBySlug.get(f.venue_slug) ?? followersBySlug.set(f.venue_slug, []).get(f.venue_slug)!).push(f.user_id);
    }

    const users = await loadUsers();
    const batch: NotificationInput[] = [];
    for (const l of listings) {
      const venue = venueById.get(l.venue_id as string);
      if (!venue) continue;
      for (const userId of followersBySlug.get(venue.slug) ?? []) {
        const ctx = users.get(userId);
        if (!ctx || !canReceive("venue_alerts", ctx.plan, ctx.prefs)) continue;
        batch.push({
          userId,
          type: "venue_alerts",
          title: `New event at ${venue.name}`,
          body: l.title,
          url: `/events/${l.slug}`,
          listingId: l.id,
          dedupKey: `venue_alerts:${l.id}`,
        });
      }
    }
    return createNotifications(batch);
  });
  return { job: "venue-alerts", written };
}

// Advanced (Insider): weekly personalized picks. Stub ranking (pref match) until
// the F8 recommendations engine lands; one item per user per ISO week.
export async function runWeeklyRecs(now: Date): Promise<JobResult> {
  const { data } = await getServiceClient()
    .from("listings")
    .select(LISTING_COLS)
    .gte("date_start", now.toISOString())
    .is("dedup_of", null)
    .not("published_at", "is", null)
    .order("date_start", { ascending: true })
    .limit(LISTING_LIMIT);
  const listings = (data ?? []) as ListingRow[];
  const users = await loadUsers();
  const key = weekKey(now);
  const batch: NotificationInput[] = [];
  for (const [userId, ctx] of users) {
    if (!canReceive("weekly_recs", ctx.plan, ctx.prefs)) continue;
    const picks = listings.filter((l) => listingMatchesProfile(toMatchListing(l), ctx)).slice(0, 5);
    if (picks.length === 0) continue;
    batch.push({
      userId,
      type: "weekly_recs",
      title: "Your weekly picks are ready",
      body: picks.slice(0, 3).map((l) => l.title).join(" · "),
      url: "/explore",
      data: { count: picks.length },
      dedupKey: `weekly_recs:${key}`,
    });
  }
  return { job: "weekly-recs", written: await createNotifications(batch) };
}
