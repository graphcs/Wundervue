import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { SUPABASE_SERVICE_ROLE_KEY } from "./env";

let cached: SupabaseClient | null = null;

// Service-role Supabase client. Bypasses RLS, so it MUST only be used from
// trusted server contexts (Stripe webhook handler, billing route handlers
// that have already authenticated the caller). Never import from client code.
export function getSupabaseAdmin(): SupabaseClient {
  if (!cached) {
    cached = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
