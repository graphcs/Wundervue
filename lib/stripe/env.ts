function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const STRIPE_SECRET_KEY = () =>
  required(process.env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY");

export const STRIPE_WEBHOOK_SECRET = () =>
  required(process.env.STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET");

export const STRIPE_PRICE_INSIDER_MONTHLY = () =>
  required(
    process.env.STRIPE_PRICE_INSIDER_MONTHLY,
    "STRIPE_PRICE_INSIDER_MONTHLY",
  );

export const SUPABASE_SERVICE_ROLE_KEY = () =>
  required(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
  );

export const APP_URL = () =>
  required(process.env.NEXT_PUBLIC_APP_URL, "NEXT_PUBLIC_APP_URL");
