"use client";

import { useEffect, useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { ONBOARDING_INTERESTS } from "@/lib/data/categories";
import { ONBOARDING_NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { LIFESTYLE_OPTIONS } from "@/lib/data/lifestyleOptions";
import { SlideOver } from "./SlideOver";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border border-b px-5 py-5">
      <h3 className="text-gray mb-3 text-[11px] font-medium uppercase tracking-[0.14em]">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface ToggleProps {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ label, desc, value, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="flex-1">
        <div className="text-dark text-[13px] font-medium">{label}</div>
        <div className="text-gray text-[12px]">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          position: "relative",
          width: 42,
          height: 24,
          borderRadius: 9999,
          background: value ? "#ff535b" : "#d5d5d5",
          padding: 0,
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
          transition: "background-color 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: value ? 21 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.2s",
          }}
        />
      </button>
    </div>
  );
}

export function AccountSettingsPanel() {
  const {
    settingsOpen,
    closeSettings,
    profile,
    updateProfile,
    signOut,
    openUpgrade,
  } = useAuthContext();

  const [name, setName] = useState(profile?.name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifDeal, setNotifDeal] = useState(true);
  const [notifReminders, setNotifReminders] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (settingsOpen && profile) {
      setName(profile.name);
      setEmail(profile.email);
      setSavedBanner(null);
    }
  }, [settingsOpen, profile]);

  if (!profile) return null;

  const initial = profile.name.trim().charAt(0).toUpperCase() || "U";

  const saveProfile = async () => {
    await updateProfile({ name, email });
    setSavedBanner("Profile updated.");
    setTimeout(() => setSavedBanner(null), 1800);
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Delete your account? This clears your local Wundervue session and cannot be undone.",
      )
    )
      return;
    await signOut();
    closeSettings();
  };

  return (
    <SlideOver
      open={settingsOpen}
      onClose={closeSettings}
      title="Account Settings"
      width={480}
    >
      {savedBanner && (
        <div className="bg-coral/10 text-coral px-5 py-2 text-[12px] font-medium">
          {savedBanner}
        </div>
      )}

      <Section title="Profile">
        <div className="mb-4 flex items-center gap-3">
          <div className="bg-coral flex h-14 w-14 items-center justify-center rounded-full text-lg font-medium text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="text-dark text-[14px] font-medium">
              {profile.name}
            </div>
            <div className="text-gray truncate text-[12px]">{profile.email}</div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-dark text-[12px] font-medium">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-border focus:border-dark rounded-lg border px-3 py-2 text-sm focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-dark text-[12px] font-medium">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-border focus:border-dark rounded-lg border px-3 py-2 text-sm focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={saveProfile}
            disabled={
              (name === profile.name && email === profile.email) || !name || !email
            }
            className="bg-dark rounded-pill self-start px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Changes
          </button>
        </div>
      </Section>

      <Section title="Interests">
        <p className="text-gray mb-3 text-[12px]">
          Picks we&apos;ll use for your personalized recommendations.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ONBOARDING_INTERESTS.map((opt) => {
            const active = profile.interests.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const next = active
                    ? profile.interests.filter((i) => i !== opt.id)
                    : [...profile.interests, opt.id];
                  updateProfile({ interests: next });
                }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] transition-colors ${
                  active
                    ? "border-dark bg-[#f9f9f9]"
                    : "border-border hover:border-dark"
                }`}
              >
                <span className="text-base leading-none">{opt.icon}</span>
                <span className="text-dark flex-1">{opt.label}</span>
                <span
                  className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded border-[1.5px] transition-colors ${
                    active ? "border-dark bg-dark" : "border-[#ccc] bg-white"
                  }`}
                >
                  {active && (
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Neighborhoods">
        <p className="text-gray mb-3 text-[12px]">
          Areas of Denver you want to explore.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ONBOARDING_NEIGHBORHOODS.map((n) => {
            const active = profile.neighborhoods.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  const next = active
                    ? profile.neighborhoods.filter((h) => h !== n)
                    : [...profile.neighborhoods, n];
                  updateProfile({ neighborhoods: next });
                }}
                className={`rounded-pill border-[1.5px] px-3.5 py-1 text-[12px] font-medium transition-colors ${
                  active
                    ? "border-dark bg-dark text-white"
                    : "border-border text-graphite hover:border-dark"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Lifestyle">
        <div className="flex flex-col gap-1.5">
          {LIFESTYLE_OPTIONS.map((opt) => {
            const active = profile.lifestyle.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const next = active
                    ? profile.lifestyle.filter((l) => l !== opt.id)
                    : [...profile.lifestyle, opt.id];
                  updateProfile({ lifestyle: next });
                }}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-dark bg-[#f9f9f9]"
                    : "border-border hover:border-dark"
                }`}
              >
                <span
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-[1.5px] transition-colors ${
                    active ? "border-dark bg-dark" : "border-[#ccc] bg-white"
                  }`}
                >
                  {active && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <div className="flex-1 leading-tight">
                  <div className="text-dark text-[13px] font-medium">
                    {opt.label}
                  </div>
                  <div className="text-gray text-[11px]">{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Subscription">
        <div
          className={`rounded-xl border-2 p-4 ${
            profile.plan === "insider" ? "border-coral" : "border-border"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-dark text-[14px] font-medium">
                {profile.plan === "insider"
                  ? "Wundervue Insider"
                  : "Wundervue Explorer"}
              </div>
              <div className="text-gray mt-0.5 text-[12px]">
                {profile.plan === "insider" ? "$4.99/month" : "Free forever"}
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                profile.plan === "insider"
                  ? "bg-coral text-white"
                  : "bg-tag-bg text-graphite"
              }`}
            >
              {profile.plan === "insider" ? "Active" : "Free"}
            </span>
          </div>
          {profile.plan === "free" && (
            <button
              type="button"
              onClick={() => {
                closeSettings();
                openUpgrade();
              }}
              className="bg-coral rounded-pill mt-3 px-4 py-2 text-[12px] font-medium text-white hover:opacity-90"
            >
              Upgrade to Insider
            </button>
          )}
        </div>
      </Section>

      <Section title="Password">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-dark text-[12px] font-medium">
              Current Password
            </span>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="border-border focus:border-dark rounded-lg border px-3 py-2 text-sm focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-dark text-[12px] font-medium">
              New Password
            </span>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="border-border focus:border-dark rounded-lg border px-3 py-2 text-sm focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setCurrentPw("");
              setNewPw("");
              setSavedBanner("Password updated.");
              setTimeout(() => setSavedBanner(null), 1800);
            }}
            disabled={!currentPw || newPw.length < 6}
            className="border-dark text-dark rounded-pill self-start border-[1.5px] px-5 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            Update Password
          </button>
        </div>
      </Section>

      <Section title="Notifications">
        <Toggle
          label="Email updates"
          desc="Weekly recommendations tailored to you"
          value={notifEmail}
          onChange={setNotifEmail}
        />
        <Toggle
          label="Deal alerts"
          desc="Notify me when new deals drop in my neighborhood"
          value={notifDeal}
          onChange={setNotifDeal}
        />
        <Toggle
          label="Event reminders"
          desc="Ping me the day of saved events"
          value={notifReminders}
          onChange={setNotifReminders}
        />
      </Section>

      <Section title="Danger Zone">
        <button
          type="button"
          onClick={handleDelete}
          className="border-coral text-coral hover:bg-coral rounded-pill border-[1.5px] px-5 py-2 text-[13px] font-medium transition-colors hover:text-white"
        >
          Delete Account
        </button>
      </Section>
    </SlideOver>
  );
}
