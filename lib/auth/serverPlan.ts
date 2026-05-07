import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Plan } from "./types";

// Server-only helper used by route handlers and server components to read the
// caller's plan. Returns null for guests or if the profile fetch fails — the
// caller is responsible for treating "no plan" as "free".
export async function getServerPlan(): Promise<Plan | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    if (error || !data) return null;
    return data.plan as Plan;
  } catch {
    return null;
  }
}
