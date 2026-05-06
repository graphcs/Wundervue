"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";

const REDIRECT_SECONDS = 5;

export default function BillingSuccessPage() {
  const { refreshSubscription, subscription } = useAuthContext();
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  // Refresh subscription in the background so the header/UI reflect Insider
  // state when the user lands back on home. The webhook may arrive a beat
  // after Stripe's success redirect, so poll briefly.
  useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    const BUDGET_MS = 8000;
    const tick = async () => {
      await refreshSubscription();
      if (cancelled) return;
      if (Date.now() - start > BUDGET_MS) return;
      setTimeout(tick, 750);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [refreshSubscription]);

  // Always count down from mount so the user gets a predictable 5s wait
  // before being returned home, regardless of how long the webhook takes.
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Navigate in a dedicated effect so router.push isn't called from inside
  // a setState updater (which would warn about updating Router during a
  // render of this component).
  useEffect(() => {
    if (secondsLeft === 0) router.push("/");
  }, [secondsLeft, router]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
      <h1 className="text-dark text-[24px] font-medium">You&apos;re an Insider</h1>
      <p className="text-gray text-[14px]">
        {subscription
          ? "Your benefits are active. Welcome to Wundervue Insider."
          : "Finalizing your subscription…"}
      </p>
      <Link
        href="/"
        className="bg-dark rounded-pill mt-4 px-6 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
      >
        Back to Wundervue
      </Link>
      {secondsLeft > 0 && (
        <p className="text-gray text-[12px]">
          Redirecting in {secondsLeft}s…
        </p>
      )}
    </main>
  );
}
