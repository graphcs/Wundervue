"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";

const REDIRECT_SECONDS = 5;

export default function BillingSuccessPage() {
  const { refreshSubscription, subscription } = useAuthContext();
  const router = useRouter();
  const [waiting, setWaiting] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    let cancelled = false;
    // The webhook may land a beat after the redirect. Poll until the
    // subscription row appears or we hit the budget — Stripe's success
    // redirect is fired before customer.subscription.created always reaches
    // us, especially in local dev with `stripe listen`.
    const start = Date.now();
    const BUDGET_MS = 8000;
    const tick = async () => {
      await refreshSubscription();
      if (cancelled) return;
      if (subscription || Date.now() - start > BUDGET_MS) {
        setWaiting(false);
        return;
      }
      setTimeout(tick, 750);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [refreshSubscription, subscription]);

  // Auto-return to home after the subscription state resolves. Counts down
  // visibly so the user knows they can click through faster.
  useEffect(() => {
    if (waiting) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          router.push("/");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [waiting, router]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
      <h1 className="text-dark text-[24px] font-medium">You&apos;re an Insider</h1>
      <p className="text-gray text-[14px]">
        {waiting
          ? "Finalizing your subscription…"
          : "Your benefits are active. Welcome to Wundervue Insider."}
      </p>
      <Link
        href="/"
        className="bg-dark rounded-pill mt-4 px-6 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
      >
        Back to Wundervue
      </Link>
      {!waiting && secondsLeft > 0 && (
        <p className="text-gray text-[12px]">
          Redirecting in {secondsLeft}s…
        </p>
      )}
    </main>
  );
}
