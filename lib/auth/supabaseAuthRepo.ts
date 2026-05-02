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
  SignUpResult,
  Subscription,
  SubscriptionStatus,
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
//
// Returns null only when the row genuinely doesn't exist (replication lag on
// fresh sign-up). Throws on query errors so callers can distinguish a missing
// row from a transient failure and avoid clobbering a known-good profile.
export async function fetchProfileForUser(
  userId: string,
  email: string | null,
): Promise<Profile | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapProfile(data as ProfileRow, { id: userId, email });
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    canceledAt: row.canceled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// RLS filters to the calling user's own rows; we still order/limit so a
// resubscriber sees their newest record.
export async function fetchSubscriptionForUser(
  userId: string,
): Promise<Subscription | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSubscription(data as SubscriptionRow) : null;
}

async function fetchProfile(): Promise<Profile | null> {
  const supabase = getSupabaseBrowserClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return null;
  return fetchProfileForUser(userRes.user.id, userRes.user.email ?? null);
}

async function requireProfileAfterAuth(): Promise<Profile> {
  // The on-signup trigger creates the row; this retry covers replication lag.
  // ~2.5s budget across 10 attempts (250ms each) covers a slow trigger
  // without making the success path noticeably slower. fetchProfile now
  // throws on query errors, so swallow inside the loop to keep retrying
  // through transient failures within the same budget.
  for (let i = 0; i < 10; i++) {
    try {
      const profile = await fetchProfile();
      if (profile) return profile;
    } catch (err) {
      console.warn("[supabaseAuthRepo] profile fetch retry", err);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  // Persistent profile-fetch failure leaves the supabase session set but no
  // profile in our state — the UI would say "logged in" with no name on next
  // load. Roll back so cookies match the UI state and the user can retry.
  try {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  } catch {
    // best-effort rollback; we still want to surface the original failure
  }
  throw new Error(
    "We couldn't finish setting up your account. Please try again in a moment.",
  );
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

  async signUp({ name, email, password }: SignUpInput): Promise<SignUpResult> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(error.message);
    if (!data.session) {
      // Email confirmations are enabled on this Supabase project. Account
      // exists but isn't usable yet — caller should render an info message,
      // not an error.
      return { pendingConfirmation: true, email };
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
