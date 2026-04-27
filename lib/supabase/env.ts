// NOTE: client-bundled `process.env.NEXT_PUBLIC_*` is replaced at build time
// only when accessed with a literal property name. Don't refactor to a
// dynamic `process.env[name]` lookup — it will be undefined in the browser.
function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const SUPABASE_URL = required(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);
export const SUPABASE_PUBLISHABLE_KEY = required(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);
