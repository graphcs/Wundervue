import type { AuthRepo } from "./authRepo";
import type {
  Profile,
  Session,
  SignInInput,
  SignUpInput,
} from "./types";

const SESSION_KEY = "wv.session";
const PROFILE_KEY = "wv.profile";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function removeKey(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function generateUserId(email: string): string {
  return `mock_${email.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
}

export const mockAuthRepo: AuthRepo = {
  getSession(): Session | null {
    return readJson<Session>(SESSION_KEY);
  },

  getProfile(): Profile | null {
    return readJson<Profile>(PROFILE_KEY);
  },

  async signIn({ email, password }: SignInInput) {
    if (!email || password.length < 6) {
      throw new Error("Invalid credentials");
    }
    const existing = readJson<Profile>(PROFILE_KEY);
    const profile: Profile =
      existing && existing.email === email
        ? existing
        : {
            userId: generateUserId(email),
            name: email.split("@")[0],
            email,
            plan: "free",
            interests: [],
            neighborhoods: [],
            lifestyle: [],
            createdAt: new Date().toISOString(),
          };
    const session: Session = {
      userId: profile.userId,
      email: profile.email,
      createdAt: new Date().toISOString(),
    };
    writeJson(SESSION_KEY, session);
    writeJson(PROFILE_KEY, profile);
    return { session, profile };
  },

  async signUp({ name, email, password }: SignUpInput) {
    if (!name || !email || password.length < 6) {
      throw new Error("Invalid signup");
    }
    const profile: Profile = {
      userId: generateUserId(email),
      name,
      email,
      plan: "free",
      interests: [],
      neighborhoods: [],
      lifestyle: [],
      createdAt: new Date().toISOString(),
    };
    const session: Session = {
      userId: profile.userId,
      email: profile.email,
      createdAt: new Date().toISOString(),
    };
    writeJson(SESSION_KEY, session);
    writeJson(PROFILE_KEY, profile);
    return { session, profile };
  },

  async signOut() {
    removeKey(SESSION_KEY);
    removeKey(PROFILE_KEY);
  },

  async updateProfile(patch: Partial<Profile>): Promise<Profile> {
    const current = readJson<Profile>(PROFILE_KEY);
    if (!current) throw new Error("No active profile");
    const next: Profile = { ...current, ...patch };
    writeJson(PROFILE_KEY, next);
    return next;
  },
};
