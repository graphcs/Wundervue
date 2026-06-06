import { getSupabaseAdmin } from "@/lib/stripe/admin";
import { getSessionUserIdBestEffort } from "@/lib/auth/sessionUser";
import {
  SUBMISSION_KIND_IDS,
  TITLE_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  EMAIL_MAX,
  URL_MAX,
  SHORT_TEXT_MAX,
  cleanField,
} from "@/lib/submissions";

export const runtime = "nodejs";

// Accept a community event/deal submission. Open to everyone; the submitter's
// id is attached best-effort when a session exists.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const kind = typeof body.kind === "string" ? body.kind : "event";
  if (!SUBMISSION_KIND_IDS.includes(kind)) {
    return Response.json({ error: "invalid kind" }, { status: 400 });
  }
  const title = cleanField(body.title, TITLE_MAX);
  if (!title) return Response.json({ error: "title required" }, { status: 400 });

  const userId = await getSessionUserIdBestEffort();

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("submissions").insert({
    kind,
    title,
    description: cleanField(body.description, DESCRIPTION_MAX),
    venue_name: cleanField(body.venueName, SHORT_TEXT_MAX),
    neighborhood: cleanField(body.neighborhood, SHORT_TEXT_MAX),
    url: cleanField(body.url, URL_MAX),
    event_date: cleanField(body.eventDate, SHORT_TEXT_MAX),
    submitter_name: cleanField(body.name, NAME_MAX),
    submitter_email: cleanField(body.email, EMAIL_MAX),
    user_id: userId,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true }, { status: 201 });
}
