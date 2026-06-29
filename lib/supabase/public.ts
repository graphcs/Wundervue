import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

let cached: SupabaseClient | undefined;

// Cookie-free anon client for PUBLIC, RLS-gated reads that must run in cookieless
// contexts — generateStaticParams, sitemap, unstable_cache — where the
// cookie-based getSupabaseServerClient() throws. Stateless (no session), so it's
// memoized to one client per process.
export function getSupabasePublicClient(): SupabaseClient {
  cached ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
