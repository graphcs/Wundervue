import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets and `/api/*`. API route handlers that need an
  // authenticated user should call `getSupabaseServerClient()` from
  // lib/supabase/server.ts directly — that path also refreshes cookies, and
  // skipping the middleware here avoids an `auth.getUser()` round-trip on
  // routes (e.g. webhooks) that don't care about the session at all.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)",
  ],
};
