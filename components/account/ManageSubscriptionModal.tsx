"use client";

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

export function ManageSubscriptionModal() {
  const { manageSubOpen, closeManageSub, profile, updateProfile } =
    useAuthContext();

  if (!profile) return null;

  const cancel = async () => {
    if (
      !window.confirm(
        "Cancel your Insider subscription? You'll keep benefits until the end of your billing period.",
      )
    )
      return;
    await updateProfile({ plan: "free" });
    closeManageSub();
  };

  const nextBilling = new Date();
  nextBilling.setMonth(nextBilling.getMonth() + 1);
  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : "—";

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
              Active
            </span>
          </div>
          <div className="border-border mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-[12px]">
            <div>
              <div className="text-gray">Next billing</div>
              <div className="text-dark mt-0.5 font-medium">
                {nextBilling.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
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

        <div className="border-border mb-5 flex items-center justify-between rounded-xl border p-3">
          <div>
            <div className="text-dark text-[13px] font-medium">
              Payment method
            </div>
            <div className="text-gray text-[12px]">Visa •••• 4242</div>
          </div>
          <button
            type="button"
            className="text-coral text-[12px] font-medium hover:underline"
          >
            Update
          </button>
        </div>

        <button
          type="button"
          onClick={cancel}
          className="border-border text-graphite rounded-pill hover:border-dark w-full border-[1.5px] py-2.5 text-[13px] font-medium transition-colors"
        >
          Cancel Subscription
        </button>
        <p className="text-gray mt-2 text-center text-[11px]">
          Benefits continue until the end of your billing period.
        </p>
      </div>
    </CenteredModal>
  );
}
