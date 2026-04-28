// Keep in sync with the SQL check constraint at
// supabase/migrations/20260425004931_profiles.sql:
//   check (plan in ('free', 'insider'))
export type Plan = "free" | "insider";

export interface Profile {
  userId: string;
  name: string;
  email: string;
  plan: Plan;
  interests: string[];
  neighborhoods: string[];
  lifestyle: string[];
  createdAt: string;
}

export interface Session {
  userId: string;
  email: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export type SignUpResult =
  | { session: Session; profile: Profile }
  | { pendingConfirmation: true; email: string };
