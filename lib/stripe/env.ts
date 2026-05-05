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

// Derives the user-facing origin to use in Checkout success/cancel URLs and
// Customer Portal return URLs. We prefer headers from the incoming request so
// that preview deployments redirect back to themselves (cookies are
// domain-scoped — redirecting from a preview URL to a hard-coded prod URL
// would log the user out post-payment). Falls back to NEXT_PUBLIC_APP_URL if
// the headers aren't available (e.g. background contexts).
export function resolveAppUrl(request: Request): string {
  const headers = request.headers;
  const forwardedHost = headers.get("x-forwarded-host");
  const forwardedProto = headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }
  const origin = headers.get("origin");
  if (origin) return origin;
  const host = headers.get("host");
  if (host) {
    const proto = forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl;
  throw new Error(
    "Cannot resolve app URL: no Origin/Host headers and NEXT_PUBLIC_APP_URL not set",
  );
}
