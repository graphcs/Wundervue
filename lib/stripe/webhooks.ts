import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./server";
import {
  markSubscriptionDeleted,
  upsertSubscriptionFromStripe,
} from "./repo";

// Handlers are pure-ish (they hit Supabase + Stripe but take no app state),
// so they can be unit-tested with stubbed clients. Each one is idempotent:
// the upsert is keyed on stripe_subscription_id, so Stripe retries are safe.
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // For subscription mode, expand the subscription and persist it. The
      // subsequent customer.subscription.created webhook will write the same
      // row again — that's fine, the upsert is idempotent.
      if (session.mode !== "subscription" || !session.subscription) return;
      const stripe = getStripe();
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      await upsertSubscriptionFromStripe(sub);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await upsertSubscriptionFromStripe(sub);
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await markSubscriptionDeleted(sub);
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subRef = (invoice as unknown as { subscription?: string | Stripe.Subscription })
        .subscription;
      if (!subRef) return;
      const stripe = getStripe();
      const subId = typeof subRef === "string" ? subRef : subRef.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      await upsertSubscriptionFromStripe(sub);
      return;
    }
    default:
      // Ignore other event types — Stripe sends many we didn't subscribe to,
      // and the dashboard webhook config controls the allow-list.
      return;
  }
}
