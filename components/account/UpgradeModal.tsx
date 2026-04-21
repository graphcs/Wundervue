"use client";

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

  const startInsider = () => {
    closeUpgrade();
    if (isLoggedIn) {
      openOnboarding(2);
    } else {
      openOnboarding(0);
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
        <p className="max-w-[280px] text-[13px] opacity-90">
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
          className="bg-dark rounded-pill w-full py-3 text-[14px] font-medium text-white hover:opacity-90"
        >
          Start Insider — $4.99/month
        </button>
        <p className="text-gray mt-2 text-center text-[11px]">
          Cancel anytime. Mock flow — no card is charged.
        </p>
      </div>
    </CenteredModal>
  );
}
