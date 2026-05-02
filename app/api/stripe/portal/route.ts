import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { APP_URL } from "@/lib/stripe/env";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await getSupabaseServerClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const user = userRes.user;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();
  if (profileErr) {
    return Response.json({ error: profileErr.message }, { status: 500 });
  }
  if (!profile?.stripe_customer_id) {
    return Response.json(
      { error: "no stripe customer for user" },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${APP_URL()}/`,
  });

  return Response.json({ url: session.url });
}
