"use client";

import { useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { CenteredModal } from "./CenteredModal";

const FEATURES = [
  {
    title: "Personalized recommendations",
    desc: "Tailored picks based on your interests and neighborhoods.",
  },
  {
    title: "Unlimited saves",
    desc: "Favorite as many events and deals as you want.",
  },
  {
    title: "Calendar sync",
    desc: "Push saved events directly to Google Calendar.",
  },
  {
    title: "Advanced lifestyle filters",
    desc: "Dog-friendly, family, date night, outdoor — pick your vibe.",
  },
  {
    title: "Exclusive deals",
    desc: "Card-linked cashback at partner Denver businesses (coming soon).",
  },
  {
    title: "Early access",
    desc: "First to know about popular events before they sell out.",
  },
];

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ff535b"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="white"
      stroke="white"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
    </svg>
  );
}

export function UpgradeModal() {
  const { upgradeOpen, closeUpgrade, openOnboarding, isLoggedIn } =
    useAuthContext();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startInsider = async () => {
    if (!isLoggedIn) {
      // Stripe Checkout requires an authenticated user (we attach metadata to
      // the customer at creation), so route guests through onboarding first.
      closeUpgrade();
      openOnboarding(0);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `checkout failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.assign(url);
    } catch (err) {
      console.error("[UpgradeModal] checkout failed", err);
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't start checkout. Please try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <CenteredModal
      open={upgradeOpen}
      onClose={closeUpgrade}
      ariaLabel="Upgrade to Insider"
    >
      <div
        className="flex flex-col items-center gap-2 px-6 py-8 text-center text-white"
        style={{ background: "linear-gradient(135deg, #FF535B, #FF8A6B)" }}
      >
        <SparkleIcon />
        <h2 className="text-[22px] font-medium leading-tight">
          Upgrade to Insider
        </h2>
        <p className="w-full max-w-[280px] text-[13px] opacity-90">
          Unlock personalized recommendations, unlimited saves, and exclusive
          deals.
        </p>
      </div>

      <div className="px-6 py-5">
        <div className="mb-5 text-center">
          <div className="text-dark text-[32px] font-medium leading-none">
            $4.99
            <span className="text-gray text-[13px] font-normal">/month</span>
          </div>
        </div>

        <ul className="mb-5 flex flex-col gap-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-2.5">
              <span className="bg-coral/10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                <CheckIcon />
              </span>
              <div>
                <div className="text-dark text-[13px] font-medium">
                  {f.title}
                </div>
                <div className="text-gray text-[12px]">{f.desc}</div>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={startInsider}
          disabled={submitting}
          className="bg-dark rounded-pill w-full py-3 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Redirecting…" : "Start Insider — $4.99/month"}
        </button>
        {error && (
          <p className="text-coral mt-2 text-center text-[11px]">{error}</p>
        )}
        <p className="text-gray mt-2 text-center text-[11px]">
          Cancel anytime. You&apos;ll be redirected to Stripe to complete payment.
        </p>
      </div>
    </CenteredModal>
  );
}
