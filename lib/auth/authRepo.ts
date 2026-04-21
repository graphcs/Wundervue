import type {
  Profile,
  Session,
  SignInInput,
  SignUpInput,
} from "./types";

export interface AuthRepo {
  getSession(): Session | null;
  getProfile(): Profile | null;
  signIn(input: SignInInput): Promise<{ session: Session; profile: Profile }>;
  signUp(input: SignUpInput): Promise<{ session: Session; profile: Profile }>;
  signOut(): Promise<void>;
  updateProfile(patch: Partial<Profile>): Promise<Profile>;
}

export type { Profile, Session, SignInInput, SignUpInput } from "./types";
