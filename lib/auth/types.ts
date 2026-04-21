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
  createdAt: string;
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
