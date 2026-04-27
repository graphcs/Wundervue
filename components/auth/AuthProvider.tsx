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
} from "@/lib/auth/types";

export interface AuthContextValue {
  hydrated: boolean;
  session: Session | null;
  profile: Profile | null;
  isLoggedIn: boolean;
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
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
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
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [initialOnboardingStep, setInitialOnboardingStep] = useState(0);
  const [savedEventsOpen, setSavedEventsOpen] = useState(false);
  const [savedVenuesOpen, setSavedVenuesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
        const [s, p] = await Promise.all([
          supabaseAuthRepo.getSession(),
          supabaseAuthRepo.getProfile(),
        ]);
        if (cancelled) return;
        setSession(s);
        setProfile(p);
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
        return;
      }
      setSession(mapSession(supaSession));
      void fetchProfileForUser(
        supaSession.user.id,
        supaSession.user.email ?? null,
      )
        .then((p) => {
          if (!cancelled) setProfile(p);
        })
        .catch((err) => {
          console.error("[AuthProvider] profile fetch failed", err);
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
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    await supabaseAuthRepo.signInWithGoogle(redirectTo);
  }, []);

  const signOut = useCallback(async () => {
    await supabaseAuthRepo.signOut();
    setSession(null);
    setProfile(null);
  }, []);

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
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openUpgrade = useCallback(() => setUpgradeOpen(true), []);
  const closeUpgrade = useCallback(() => setUpgradeOpen(false), []);
  const openManageSub = useCallback(() => setManageSubOpen(true), []);
  const closeManageSub = useCallback(() => setManageSubOpen(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      hydrated,
      session,
      profile,
      isLoggedIn: Boolean(session),
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
      settingsOpen,
      openSettings,
      closeSettings,
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
      settingsOpen,
      openSettings,
      closeSettings,
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
