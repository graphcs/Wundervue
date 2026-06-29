import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { getOrCreateCustomer } from "@/lib/stripe/repo";
import { resolveAppUrl, STRIPE_PRICE_INSIDER_MONTHLY } from "@/lib/stripe/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const user = userRes.user;
  const email = user.email;
  if (!email) {
    return Response.json({ error: "missing email on user" }, { status: 400 });
  }

  const customerId = await getOrCreateCustomer({ userId: user.id, email });

  const stripe = getStripe();
  const appUrl = resolveAppUrl(request);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_INSIDER_MONTHLY(), quantity: 1 }],
    success_url: `${appUrl}/account/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/?upgrade=cancelled`,
    allow_promotion_codes: true,
    // Skip card collection when nothing is owed (e.g. a 100%-off comp coupon),
    // so comped users can subscribe without entering a payment method. Paid
    // upgrades still collect a card because an amount is due.
    payment_method_collection: "if_required",
    subscription_data: { metadata: { user_id: user.id } },
    client_reference_id: user.id,
  });

  if (!session.url) {
    return Response.json({ error: "stripe did not return a url" }, { status: 502 });
  }
  return Response.json({ url: session.url });
}
