import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// The signed-in user's id, or null for guests / on failure. For public
// endpoints that attach the author best-effort without requiring auth.
export async function getSessionUserIdBestEffort(): Promise<string | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}
