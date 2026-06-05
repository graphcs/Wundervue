import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getServerPlan } from "@/lib/auth/serverPlan";
import { randomShareSlug } from "@/lib/shareSlug";

export const runtime = "nodejs";

// Mint (or rotate) the caller's calendar_token for the .ics sync feed.
// Insider-only. Returns the token; the client builds the subscribe URL.
export async function POST() {
  const supabase = await getSupabaseServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if ((await getServerPlan()) !== "insider") {
    return Response.json({ error: "insider only" }, { status: 403 });
  }

  const token = randomShareSlug(20);
  const { error } = await supabase
    .from("profiles")
    .update({ calendar_token: token })
    .eq("user_id", userRes.user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ token });
}
