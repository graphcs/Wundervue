import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/stripe/admin";
import {
  REPORT_ISSUE_IDS,
  REPORT_NOTE_MAX,
  REPORT_EMAIL_MAX,
} from "@/lib/reports";

export const runtime = "nodejs";

// Accept a "report an issue" submission for a listing. Open to everyone (logged
// in or not); the user id is attached best-effort when a session exists.
export async function POST(request: Request) {
  let body: {
    listingId?: unknown;
    issueType?: unknown;
    note?: unknown;
    email?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
  const issueType = typeof body.issueType === "string" ? body.issueType : "";
  if (!listingId) {
    return Response.json({ error: "listingId required" }, { status: 400 });
  }
  if (!REPORT_ISSUE_IDS.includes(issueType)) {
    return Response.json({ error: "invalid issueType" }, { status: 400 });
  }

  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, REPORT_NOTE_MAX)
      : null;
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim().slice(0, REPORT_EMAIL_MAX)
      : null;

  // Attach the reporter's id when logged in; anonymous reports are allowed.
  let userId: string | null = null;
  try {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("listing_reports").insert({
    listing_id: listingId,
    issue_type: issueType,
    note,
    email,
    user_id: userId,
  });
  if (error) {
    // 23503 = FK violation (unknown listing id) → client error, not server.
    const status = error.code === "23503" ? 400 : 500;
    return Response.json({ error: error.message }, { status });
  }

  return Response.json({ ok: true }, { status: 201 });
}
