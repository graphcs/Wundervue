import "server-only";
import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "./env";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!cached) {
    // Don't pass apiVersion — the SDK pins to its bundled version, which is
    // what the bundled types describe. Passing a literal would just risk
    // drift on upgrade.
    cached = new Stripe(STRIPE_SECRET_KEY(), {
      typescript: true,
      appInfo: { name: "Wundervue", version: "0.1.0" },
    });
  }
  return cached;
}
