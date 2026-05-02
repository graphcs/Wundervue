import "server-only";
import type Stripe from "stripe";
import type { Plan } from "@/lib/auth/types";
import type { Subscription, SubscriptionStatus } from "./types";
import { getSupabaseAdmin } from "./admin";
import { getStripe } from "./server";

interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    canceledAt: row.canceled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 'active' and 'trialing' are the two Stripe statuses that grant Insider
// access. Everything else (past_due, canceled, unpaid, incomplete*, paused)
// drops the user back to free immediately. Stripe also offers grace periods
// via dunning, but we let `cancel_at_period_end` carry that nuance — the
// subscription stays 'active' until period end, then becomes 'canceled'.
function planForStatus(status: SubscriptionStatus): Plan {
  return status === "active" || status === "trialing" ? "insider" : "free";
}

export async function getOrCreateCustomer({
  userId,
  email,
}: {
  userId: string;
  email: string;
}): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(`profile lookup failed: ${error.message}`);
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("user_id", userId);
  if (updateErr) {
    // Best-effort: roll back the Stripe customer to avoid orphan records.
    await stripe.customers.del(customer.id).catch(() => {});
    throw new Error(`persist customer id failed: ${updateErr.message}`);
  }
  return customer.id;
}

async function resolveUserId(sub: Stripe.Subscription): Promise<string | null> {
  // Prefer the metadata stamped at customer creation; fall back to a lookup
  // by stripe_customer_id for customers created via the dashboard or before
  // metadata existed.
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (typeof sub.customer !== "string" && "metadata" in sub.customer) {
    const fromMeta = sub.customer.metadata?.user_id;
    if (fromMeta) return fromMeta;
  }
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer.deleted && customer.metadata?.user_id) {
    return customer.metadata.user_id;
  }
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function upsertSubscriptionFromStripe(
  sub: Stripe.Subscription,
): Promise<void> {
  const userId = await resolveUserId(sub);
  if (!userId) {
    throw new Error(
      `cannot resolve user_id for stripe subscription ${sub.id} (customer ${
        typeof sub.customer === "string" ? sub.customer : sub.customer.id
      })`,
    );
  }

  const item = sub.items.data[0];
  if (!item) throw new Error(`subscription ${sub.id} has no items`);

  const status = sub.status as SubscriptionStatus;
  const periodEndUnix = (sub as unknown as { current_period_end?: number })
    .current_period_end;

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: sub.id,
        stripe_price_id: item.price.id,
        status,
        current_period_end:
          typeof periodEndUnix === "number"
            ? new Date(periodEndUnix * 1000).toISOString()
            : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        canceled_at: sub.canceled_at
          ? new Date(sub.canceled_at * 1000).toISOString()
          : null,
      },
      { onConflict: "stripe_subscription_id" },
    );
  if (error) throw new Error(`upsert subscription failed: ${error.message}`);

  const plan = planForStatus(status);
  const { error: profileErr } = await admin
    .from("profiles")
    .update({ plan })
    .eq("user_id", userId);
  if (profileErr) {
    throw new Error(`sync profile.plan failed: ${profileErr.message}`);
  }
}

export async function markSubscriptionDeleted(
  sub: Stripe.Subscription,
): Promise<void> {
  const userId = await resolveUserId(sub);
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      cancel_at_period_end: false,
    })
    .eq("stripe_subscription_id", sub.id);
  if (error) throw new Error(`mark subscription canceled failed: ${error.message}`);

  if (userId) {
    const { error: profileErr } = await admin
      .from("profiles")
      .update({ plan: "free" })
      .eq("user_id", userId);
    if (profileErr) {
      throw new Error(`sync profile.plan failed: ${profileErr.message}`);
    }
  }
}

export async function getActiveSubscriptionForUser(
  userId: string,
): Promise<Subscription | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as SubscriptionRow) : null;
}
