import type { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { STRIPE_WEBHOOK_SECRET } from "@/lib/stripe/env";
import { handleStripeEvent } from "@/lib/stripe/webhooks";

export const runtime = "nodejs";
// Webhook bodies are JSON but signature verification requires the exact raw
// bytes Stripe signed — we read the body as text below.

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return new Response("missing stripe-signature header", { status: 400 });
  }
  const body = await request.text();

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET());
  } catch (err) {
    const message = err instanceof Error ? err.message : "signature verification failed";
    return new Response(`bad signature: ${message}`, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    // Log and return 500 so Stripe will retry. Don't include the error in the
    // response body — the dashboard surfaces the status code, and we keep the
    // body terse to avoid leaking internals.
    console.error("[stripe webhook] handler error", { type: event.type, err });
    return new Response("handler error", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
