"use client";

import { useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { CenteredModal } from "./CenteredModal";

const BENEFITS = [
  "Unlimited saves & favorites",
  "Calendar sync for every event",
  "Personalized Denver recommendations",
  "Advanced lifestyle filters",
  "Early access to popular events",
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ManageSubscriptionModal() {
  const { manageSubOpen, closeManageSub, profile, subscription } =
    useAuthContext();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  const openPortal = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `portal failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.assign(url);
    } catch (err) {
      console.error("[ManageSubscriptionModal] portal failed", err);
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't open billing portal. Please try again.",
      );
      setSubmitting(false);
    }
  };

  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : "—";

  const isActive =
    subscription?.status === "active" || subscription?.status === "trialing";
  const cancelling = isActive && subscription?.cancelAtPeriodEnd;
  const statusLabel = cancelling
    ? "Canceling"
    : isActive
      ? "Active"
      : (subscription?.status ?? "Inactive");

  return (
    <CenteredModal
      open={manageSubOpen}
      onClose={closeManageSub}
      ariaLabel="Manage Subscription"
    >
      <div className="px-6 pb-6 pt-8">
        <h2 className="text-dark mb-4 text-[20px] font-medium">
          Manage Subscription
        </h2>

        <div className="border-coral mb-5 rounded-xl border-2 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-dark text-[14px] font-medium">
                Wundervue Insider
              </div>
              <div className="text-gray mt-0.5 text-[12px]">$4.99/month</div>
            </div>
            <span className="bg-coral rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              {statusLabel}
            </span>
          </div>
          <div className="border-border mt-3 grid grid-cols-1 gap-3 border-t pt-3 text-[12px] sm:grid-cols-2">
            <div>
              <div className="text-gray">
                {cancelling ? "Ends" : "Next billing"}
              </div>
              <div className="text-dark mt-0.5 font-medium">
                {formatDate(subscription?.currentPeriodEnd ?? null)}
              </div>
            </div>
            <div>
              <div className="text-gray">Member since</div>
              <div className="text-dark mt-0.5 font-medium">{memberSince}</div>
            </div>
          </div>
        </div>

        <h3 className="text-dark mb-3 text-[12px] font-bold uppercase tracking-wider">
          Your benefits
        </h3>
        <ul className="mb-5 flex flex-col gap-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-2.5">
              <span className="bg-coral/10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                <CheckIcon />
              </span>
              <span className="text-dark text-[13px]">{b}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={openPortal}
          disabled={submitting}
          className="bg-dark rounded-pill mb-2 w-full py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Opening…" : "Manage billing & payment method"}
        </button>
        <button
          type="button"
          onClick={openPortal}
          disabled={submitting}
          className="border-border text-graphite rounded-pill hover:border-dark w-full border-[1.5px] py-2.5 text-[13px] font-medium transition-colors disabled:opacity-60"
        >
          {cancelling ? "Resume Subscription" : "Cancel Subscription"}
        </button>
        {error && (
          <p className="text-coral mt-2 text-center text-[11px]">{error}</p>
        )}
        <p className="text-gray mt-2 text-center text-[11px]">
          Cancellations take effect at the end of your current billing period.
        </p>
      </div>
    </CenteredModal>
  );
}
