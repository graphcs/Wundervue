import { getSupabaseAdmin } from "@/lib/stripe/admin";
import { buildIcsFeed, toIcsDate, type IcsEvent } from "@/lib/calendar/ics";

export const runtime = "nodejs";

// Unauthenticated .ics subscription feed of a user's saved events, identified by
// their secret calendar_token. Served only for Insiders (the token is minted
// Insider-only, and we re-check plan here so a downgrade stops the feed). A
// missing/unknown/non-Insider token returns 404 to avoid leaking which exist.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return new Response("Not found", { status: 404 });

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id, plan")
    .eq("calendar_token", token)
    .maybeSingle();
  if (!profile || (profile as { plan: string }).plan !== "insider") {
    return new Response("Not found", { status: 404 });
  }
  const userId = (profile as { user_id: string }).user_id;

  const { data: favRows } = await admin
    .from("favorites")
    .select("listing_id")
    .eq("user_id", userId);
  const ids = (favRows ?? []).map((r) => (r as { listing_id: string }).listing_id);

  let events: IcsEvent[] = [];
  if (ids.length > 0) {
    const { data: rows } = await admin
      .from("listings")
      .select("id, title, description, address, date_start, date_end, source_url")
      .in("id", ids)
      .not("published_at", "is", null);
    events = (rows ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id as string,
        title: (row.title as string) ?? "Event",
        startAt: (row.date_start as string) ?? "",
        endAt: (row.date_end as string) ?? null,
        description: (row.description as string) ?? null,
        location: (row.address as string) ?? null,
        url: (row.source_url as string) ?? null,
      };
    });
  }

  const dtstamp = toIcsDate(new Date().toISOString()) ?? "";
  const body = buildIcsFeed(events, { calName: "Wundervue — Saved Events", dtstamp });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="wundervue-saved.ics"',
      // Calendar apps refetch periodically; let them cache briefly.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
