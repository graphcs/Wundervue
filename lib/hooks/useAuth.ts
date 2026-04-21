"use client";

import { useAuthContext } from "@/components/auth/AuthProvider";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  plan: "free" | "insider";
  initial: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  user: AuthUser | null;
  hydrated: boolean;
}

export function useAuth(): AuthState {
  const { hydrated, isLoggedIn, profile } = useAuthContext();
  const user: AuthUser | null = profile
    ? {
        id: profile.userId,
        name: profile.name,
        email: profile.email,
        plan: profile.plan,
        initial: profile.name.trim().charAt(0).toUpperCase() || "U",
      }
    : null;
  return { hydrated, isLoggedIn, user };
}
