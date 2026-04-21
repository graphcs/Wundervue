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
import { mockAuthRepo } from "@/lib/auth/mockAuthRepo";
import type {
  Profile,
  Session,
  SignInInput,
  SignUpInput,
} from "@/lib/auth/types";

export interface AuthContextValue {
  hydrated: boolean;
  session: Session | null;
  profile: Profile | null;
  isLoggedIn: boolean;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
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
    setSession(mockAuthRepo.getSession());
    setProfile(mockAuthRepo.getProfile());
    setHydrated(true);
  }, []);

  const signIn = useCallback(async (input: SignInInput) => {
    const { session: s, profile: p } = await mockAuthRepo.signIn(input);
    setSession(s);
    setProfile(p);
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const { session: s, profile: p } = await mockAuthRepo.signUp(input);
    setSession(s);
    setProfile(p);
  }, []);

  const signOut = useCallback(async () => {
    await mockAuthRepo.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    const next = await mockAuthRepo.updateProfile(patch);
    setProfile(next);
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
      signOut,
      updateProfile,
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
      signOut,
      updateProfile,
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
