import type {
  Profile,
  Session,
  SignInInput,
  SignUpInput,
} from "./types";

export interface AuthRepo {
  getSession(): Promise<Session | null>;
  getProfile(): Promise<Profile | null>;
  signIn(input: SignInInput): Promise<{ session: Session; profile: Profile }>;
  signUp(input: SignUpInput): Promise<{ session: Session; profile: Profile }>;
  signInWithGoogle(redirectTo: string): Promise<void>;
  signOut(): Promise<void>;
  updateProfile(patch: Partial<Profile>): Promise<Profile>;
  resetPassword(email: string, redirectTo: string): Promise<void>;
}

export type { Profile, Session, SignInInput, SignUpInput } from "./types";
