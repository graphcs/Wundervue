import { getSupabaseAdmin } from "@/lib/stripe/admin";
import { getSessionUserIdBestEffort } from "@/lib/auth/sessionUser";
import {
  INQUIRY_TYPE_IDS,
  NAME_MAX,
  EMAIL_MAX,
  SHORT_TEXT_MAX,
  MESSAGE_MAX,
  cleanField,
} from "@/lib/submissions";

export const runtime = "nodejs";

// Accept a "Work With Us" partner/advertise/media inquiry. Open to everyone.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const inquiryType = typeof body.inquiryType === "string" ? body.inquiryType : "partnership";
  if (!INQUIRY_TYPE_IDS.includes(inquiryType)) {
    return Response.json({ error: "invalid inquiryType" }, { status: 400 });
  }
  const name = cleanField(body.name, NAME_MAX);
  const email = cleanField(body.email, EMAIL_MAX);
  const message = cleanField(body.message, MESSAGE_MAX);
  if (!name) return Response.json({ error: "name required" }, { status: 400 });
  if (!email) return Response.json({ error: "email required" }, { status: 400 });
  if (!message) return Response.json({ error: "message required" }, { status: 400 });

  const userId = await getSessionUserIdBestEffort();

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("partner_inquiries").insert({
    inquiry_type: inquiryType,
    name,
    email,
    company: cleanField(body.company, SHORT_TEXT_MAX),
    message,
    user_id: userId,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true }, { status: 201 });
}
