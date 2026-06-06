import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Plan } from "./types";

// Server-only helper used by route handlers and server components to read the
// caller's plan. Returns null for guests or if the profile fetch fails — the
// caller is responsible for treating "no plan" as "free".
export async function getServerPlan(): Promise<Plan | null> {
  return (await getServerProfile())?.plan ?? null;
}

export interface ServerProfile {
  plan: Plan | null;
  interests: string[];
  neighborhoods: string[];
  lifestyle: string[];
}

// Like getServerPlan but also returns the personalization prefs used by the
// "For You" feed. Null for guests / on failure.
export async function getServerProfile(): Promise<ServerProfile | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("plan, interests, neighborhoods, lifestyle")
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      plan: (data.plan as Plan) ?? null,
      interests: (data.interests as string[]) ?? [],
      neighborhoods: (data.neighborhoods as string[]) ?? [],
      lifestyle: (data.lifestyle as string[]) ?? [],
    };
  } catch {
    return null;
  }
}
