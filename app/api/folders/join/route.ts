import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/stripe/admin";
import { getServerPlan } from "@/lib/auth/serverPlan";

export const runtime = "nodejs";

// Join a folder as a collaborator via its share slug. Insider-only; the
// service role inserts the folder_collaborators row (folder_items RLS then lets
// the collaborator add/remove items). Guests/free are turned away with a reason
// the join page renders as sign-in / upgrade.
export async function POST(request: Request) {
  let body: { shareSlug?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const shareSlug = typeof body.shareSlug === "string" ? body.shareSlug.trim() : "";
  if (!shareSlug) return Response.json({ error: "shareSlug required" }, { status: 400 });

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "auth", reason: "signin" }, { status: 401 });

  const plan = await getServerPlan();
  if (plan !== "insider") return Response.json({ error: "gated", reason: "upgrade" }, { status: 403 });

  const admin = getSupabaseAdmin();
  const { data: folder } = await admin
    .from("saved_folders")
    .select("id, user_id")
    .eq("share_slug", shareSlug)
    .maybeSingle();
  if (!folder) return Response.json({ error: "not_found" }, { status: 404 });
  const f = folder as { id: string; user_id: string };

  if (f.user_id === user.id) return Response.json({ ok: true, owner: true });

  const { error } = await admin
    .from("folder_collaborators")
    .upsert({ folder_id: f.id, user_id: user.id }, { onConflict: "folder_id,user_id", ignoreDuplicates: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
