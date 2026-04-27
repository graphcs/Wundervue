"use client";

import type { Session as SupaSession, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AuthRepo } from "./authRepo";
import type {
  Plan,
  Profile,
  Session,
  SignInInput,
  SignUpInput,
} from "./types";

interface ProfileRow {
  user_id: string;
  name: string;
  plan: Plan;
  interests: string[] | null;
  neighborhoods: string[] | null;
  lifestyle: string[] | null;
  created_at: string;
}

export function mapSession(s: SupaSession | null): Session | null {
  if (!s) return null;
  return {
    userId: s.user.id,
    email: s.user.email ?? "",
    createdAt: new Date(s.user.created_at).toISOString(),
  };
}

function mapProfile(row: ProfileRow, user: User | { id: string; email?: string | null }): Profile {
  return {
    userId: row.user_id,
    name: row.name,
    email: user.email ?? "",
    plan: row.plan,
    interests: row.interests ?? [],
    neighborhoods: row.neighborhoods ?? [],
    lifestyle: row.lifestyle ?? [],
    createdAt: row.created_at,
  };
}

// Lock-free profile fetch — does NOT call supabase.auth.getUser(), so it is
// safe to invoke from inside an onAuthStateChange callback (which itself runs
// while supabase-js holds the auth lock during _initialize / _recoverAndRefresh).
export async function fetchProfileForUser(
  userId: string,
  email: string | null,
): Promise<Profile | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return mapProfile(data as ProfileRow, { id: userId, email });
}

async function fetchProfile(): Promise<Profile | null> {
  const supabase = getSupabaseBrowserClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return null;
  return fetchProfileForUser(userRes.user.id, userRes.user.email ?? null);
}

async function requireProfileAfterAuth(): Promise<Profile> {
  // Trigger creates the row; brief retry covers replication lag.
  for (let i = 0; i < 5; i++) {
    const profile = await fetchProfile();
    if (profile) return profile;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Profile not found after sign-in");
}

export const supabaseAuthRepo: AuthRepo = {
  async getSession() {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return mapSession(data.session);
  },

  async getProfile() {
    return fetchProfile();
  },

  async signIn({ email, password }: SignInInput) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) {
      throw new Error(error?.message ?? "Sign-in failed");
    }
    const profile = await requireProfileAfterAuth();
    return { session: mapSession(data.session)!, profile };
  },

  async signUp({ name, email, password }: SignUpInput) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(error.message);
    if (!data.session) {
      // Email confirmations may be enabled — surface a clear error.
      throw new Error(
        "Account created. Check your email to confirm before signing in.",
      );
    }
    const profile = await requireProfileAfterAuth();
    return { session: mapSession(data.session)!, profile };
  },

  async signInWithGoogle(redirectTo: string) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw new Error(error.message);
  },

  async signOut() {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  async updateProfile(patch: Partial<Profile>): Promise<Profile> {
    const supabase = getSupabaseBrowserClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) throw new Error("Not signed in");

    const dbPatch: Partial<ProfileRow> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.plan !== undefined) dbPatch.plan = patch.plan;
    if (patch.interests !== undefined) dbPatch.interests = patch.interests;
    if (patch.neighborhoods !== undefined)
      dbPatch.neighborhoods = patch.neighborhoods;
    if (patch.lifestyle !== undefined) dbPatch.lifestyle = patch.lifestyle;

    const { data, error } = await supabase
      .from("profiles")
      .update(dbPatch)
      .eq("user_id", userRes.user.id)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Update failed");

    return mapProfile(data as ProfileRow, userRes.user);
  },

  async resetPassword(email: string, redirectTo: string) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw new Error(error.message);
  },
};
