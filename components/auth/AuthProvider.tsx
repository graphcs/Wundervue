"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchProfileForUser,
  fetchSubscriptionForUser,
  mapSession,
  supabaseAuthRepo,
} from "@/lib/auth/supabaseAuthRepo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AuthChangeEvent,
  Session as SupaSession,
} from "@supabase/supabase-js";
import type {
  Profile,
  Session,
  SignInInput,
  SignUpInput,
  SignUpResult,
  Subscription,
} from "@/lib/auth/types";

export interface AuthContextValue {
  hydrated: boolean;
  session: Session | null;
  profile: Profile | null;
  subscription: Subscription | null;
  // True when the most recent profile fetch failed for a non-missing-row
  // reason (network, RLS, server error). UI can render a non-blocking
  // notice; the next successful auth-state change clears it.
  profileError: boolean;
  isLoggedIn: boolean;
  refreshSubscription: () => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  onboardingOpen: boolean;
  openOnboarding: (step?: number) => void;
  closeOnboarding: () => void;
  initialOnboardingStep: number;
  savedEventsOpen: boolean;
  openSavedEvents: () => void;
  closeSavedEvents: () => void;
  savedVenuesOpen: boolean;
  openSavedVenues: () => void;
  closeSavedVenues: () => void;
  upgradeOpen: boolean;
  openUpgrade: () => void;
  closeUpgrade: () => void;
  manageSubOpen: boolean;
  openManageSub: () => void;
  closeManageSub: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [initialOnboardingStep, setInitialOnboardingStep] = useState(0);
  const [savedEventsOpen, setSavedEventsOpen] = useState(false);
  const [savedVenuesOpen, setSavedVenuesOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [manageSubOpen, setManageSubOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Fallback: if supabase-js gets stuck (e.g. an expired-session refresh
    // hang inside its navigator-locks lock), unblock the UI after this
    // deadline so the header is interactive. We do NOT clear cookies or
    // mark the user signed out — if auth resolves later we apply the
    // result then, so a slow load just delays the avatar instead of
    // logging the user out.
    const HYDRATE_DEADLINE_MS = 8000;
    const deadline = setTimeout(() => {
      if (!cancelled) setHydrated(true);
    }, HYDRATE_DEADLINE_MS);

    (async () => {
      try {
        // getProfile() now throws on transient query failure; swallow here
        // so a slow/erroring profile fetch doesn't also drop the session we
        // already retrieved. The listener will refresh profile on the next
        // token refresh.
        let profileFailed = false;
        const [s, p] = await Promise.all([
          supabaseAuthRepo.getSession(),
          supabaseAuthRepo.getProfile().catch((err) => {
            console.error("[AuthProvider] profile hydration failed", err);
            profileFailed = true;
            return null;
          }),
        ]);
        if (cancelled) return;
        setSession(s);
        setProfile(p);
        if (profileFailed) setProfileError(true);

        if (s) {
          try {
            const sub = await fetchSubscriptionForUser(s.userId);
            if (!cancelled) setSubscription(sub);
          } catch (err) {
            console.error("[AuthProvider] subscription hydration failed", err);
          }
        }
      } catch (err) {
        console.error("[AuthProvider] hydration failed", err);
      } finally {
        if (!cancelled) {
          clearTimeout(deadline);
          setHydrated(true);
        }
      }
    })();

    const supabase = getSupabaseBrowserClient();
    // IMPORTANT: this callback runs from inside supabase-js's auth lock during
    // _initialize / _recoverAndRefresh. Calling supabase.auth.getSession() or
    // .getUser() here would re-enter the lock and deadlock with _initialize,
    // which leaves the UI permanently in the "not hydrated" state and looks
    // like a forced sign-out on refresh. Use the session passed in directly,
    // and fetch the profile via a query that doesn't touch auth.* methods.
    const { data: sub } = supabase.auth.onAuthStateChange((
      event: AuthChangeEvent,
      supaSession: SupaSession | null,
    ) => {
      if (event === "SIGNED_OUT" || !supaSession) {
        setSession(null);
        setProfile(null);
        setSubscription(null);
        setProfileError(false);
        return;
      }
      setSession(mapSession(supaSession));
      void fetchProfileForUser(
        supaSession.user.id,
        supaSession.user.email ?? null,
      )
        .then((p) => {
          if (cancelled) return;
          // Only overwrite when the fetch returned a profile. A null here
          // means the row genuinely doesn't exist (e.g. fresh sign-up before
          // the trigger fires); a query error would have thrown into catch.
          // In both cases, preserve any existing profile rather than
          // dropping the user into the "logged in but no name" state on a
          // transient hiccup during a token refresh.
          if (p) setProfile(p);
          setProfileError(false);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("[AuthProvider] profile fetch failed", err);
          setProfileError(true);
        });
      void fetchSubscriptionForUser(supaSession.user.id)
        .then((sub) => {
          if (cancelled) return;
          setSubscription(sub);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("[AuthProvider] subscription fetch failed", err);
        });
    });

    return () => {
      cancelled = true;
      clearTimeout(deadline);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (input: SignInInput) => {
    const { session: s, profile: p } = await supabaseAuthRepo.signIn(input);
    setSession(s);
    setProfile(p);
  }, []);

  const signUp = useCallback(async (input: SignUpInput): Promise<SignUpResult> => {
    const result = await supabaseAuthRepo.signUp(input);
    if ("pendingConfirmation" in result) {
      // Account exists but needs email confirmation; do not mark as logged in.
      return result;
    }
    setSession(result.session);
    setProfile(result.profile);
    return result;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    // Don't bounce the user back to /auth/* after sign-in: the recovery
    // page would re-disable itself and the callback would re-loop. Strip
    // those paths and fall back to the home page.
    const path = window.location.pathname;
    const next = path.startsWith("/auth/")
      ? "/"
      : path + window.location.search;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    await supabaseAuthRepo.signInWithGoogle(redirectTo);
  }, []);

  const signOut = useCallback(async () => {
    await supabaseAuthRepo.signOut();
    setSession(null);
    setProfile(null);
    setSubscription(null);
  }, []);

  const refreshSubscription = useCallback(async () => {
    if (!session) {
      setSubscription(null);
      return;
    }
    try {
      const sub = await fetchSubscriptionForUser(session.userId);
      setSubscription(sub);
    } catch (err) {
      console.error("[AuthProvider] refreshSubscription failed", err);
    }
  }, [session]);

  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    const next = await supabaseAuthRepo.updateProfile(patch);
    setProfile(next);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/auth/reset`;
    await supabaseAuthRepo.resetPassword(email, redirectTo);
  }, []);

  const openOnboarding = useCallback((step: number = 0) => {
    setInitialOnboardingStep(step);
    setOnboardingOpen(true);
  }, []);

  const closeOnboarding = useCallback(() => {
    setOnboardingOpen(false);
  }, []);

  const openSavedEvents = useCallback(() => setSavedEventsOpen(true), []);
  const closeSavedEvents = useCallback(() => setSavedEventsOpen(false), []);
  const openSavedVenues = useCallback(() => setSavedVenuesOpen(true), []);
  const closeSavedVenues = useCallback(() => setSavedVenuesOpen(false), []);
  const openUpgrade = useCallback(() => setUpgradeOpen(true), []);
  const closeUpgrade = useCallback(() => setUpgradeOpen(false), []);
  const openManageSub = useCallback(() => setManageSubOpen(true), []);
  const closeManageSub = useCallback(() => setManageSubOpen(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      hydrated,
      session,
      profile,
      subscription,
      profileError,
      isLoggedIn: Boolean(session),
      refreshSubscription,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      updateProfile,
      resetPassword,
      onboardingOpen,
      openOnboarding,
      closeOnboarding,
      initialOnboardingStep,
      savedEventsOpen,
      openSavedEvents,
      closeSavedEvents,
      savedVenuesOpen,
      openSavedVenues,
      closeSavedVenues,
      upgradeOpen,
      openUpgrade,
      closeUpgrade,
      manageSubOpen,
      openManageSub,
      closeManageSub,
    }),
    [
      hydrated,
      session,
      profile,
      subscription,
      profileError,
      refreshSubscription,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      updateProfile,
      resetPassword,
      onboardingOpen,
      openOnboarding,
      closeOnboarding,
      initialOnboardingStep,
      savedEventsOpen,
      openSavedEvents,
      closeSavedEvents,
      savedVenuesOpen,
      openSavedVenues,
      closeSavedVenues,
      upgradeOpen,
      openUpgrade,
      closeUpgrade,
      manageSubOpen,
      openManageSub,
      closeManageSub,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
