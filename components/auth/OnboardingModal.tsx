"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuthContext } from "./AuthProvider";
import {
  ONBOARDING_INTERESTS,
} from "@/lib/data/categories";
import { ONBOARDING_NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { LIFESTYLE_OPTIONS } from "@/lib/data/lifestyleOptions";
import type { Plan } from "@/lib/auth/types";

type Step = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6;

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="bg-border h-px flex-1" />
      <span className="text-gray text-[11px]">or</span>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}

interface FieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  autoFocus,
}: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-dark text-[12px] font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className="border-border text-dark placeholder:text-chrome focus:border-dark rounded-lg border bg-white px-3.5 py-2.5 text-sm focus:outline-none"
      />
    </label>
  );
}

function PrimaryButton({
  disabled,
  children,
  onClick,
  type = "button",
  className = "",
}: {
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`bg-dark rounded-pill px-6 py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function GoogleButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border-border hover:border-dark flex items-center justify-center gap-2.5 rounded-pill border px-4 py-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
    >
      <GoogleIcon />
      {children}
    </button>
  );
}

export function OnboardingModal() {
  const {
    hydrated,
    onboardingOpen,
    closeOnboarding,
    initialOnboardingStep,
    signUp,
    signIn,
    signInWithGoogle,
    updateProfile,
    resetPassword,
  } = useAuthContext();

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [hoods, setHoods] = useState<Set<string>>(new Set());
  const [lifestyle, setLifestyle] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (onboardingOpen) {
      setStep(initialOnboardingStep as Step);
      setError(null);
    }
  }, [onboardingOpen, initialOnboardingStep]);

  useEffect(() => {
    if (!onboardingOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOnboarding();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onboardingOpen, closeOnboarding]);

  if (!hydrated || !onboardingOpen) return null;

  const close = () => {
    closeOnboarding();
    // reset local state shortly after close for next open
    setTimeout(() => {
      setStep(0);
      setName("");
      setEmail("");
      setPassword("");
      setPlan(null);
      setInterests(new Set());
      setHoods(new Set());
      setLifestyle(new Set());
      setError(null);
      setResetSent(false);
      setPendingConfirmationEmail(null);
    }, 200);
  };

  const toggleIn = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFn(next);
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setPendingConfirmationEmail(null);
    setSubmitting(true);
    try {
      const result = await signUp({ name, email, password });
      if ("pendingConfirmation" in result) {
        // Email confirmation is required — show an info message instead of
        // advancing into onboarding (the user isn't signed in yet).
        setPendingConfirmationEmail(result.email);
        return;
      }
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn({ email, password });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      // Browser is redirecting; nothing else to do.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Enter your email above first");
      return;
    }
    setError(null);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset");
    }
  };

  const choosePlan = (p: Plan) => setPlan(p);

  const continueFromPlan = async () => {
    if (!plan) return;
    if (plan === "free") {
      // Profiles default to 'free'; plan is server-controlled (Stripe webhook),
      // so there's nothing to write here.
      setStep(6);
      return;
    }
    // Insider: don't set plan locally — the Stripe webhook flips it to
    // 'insider' once payment succeeds. Skip the (deleted) mock payment step
    // and continue collecting profile prefs; checkout fires at the end.
    setStep(3);
  };

  const advanceInsider = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await updateProfile({
        interests: Array.from(interests),
        neighborhoods: Array.from(hoods),
        lifestyle: Array.from(lifestyle),
      });
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
      console.error("[OnboardingModal] checkout failed", err);
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't start checkout. Please try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ height: 540, maxHeight: "min(90vh, 540px)" }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="hover:bg-tag-bg text-gray absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
          {step === -1 && (
            <>
              <h2 className="text-dark mb-2 text-[22px] font-medium">Welcome back</h2>
              <p className="text-gray mb-5 text-[13px]">Log in to your Wundervue account.</p>
              <div className="flex flex-col gap-3">
                <GoogleButton onClick={handleGoogle} disabled={submitting}>
                  Log in with Google
                </GoogleButton>
                <Divider />
                <form onSubmit={handleLogin} className="flex flex-col gap-3">
                  <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required autoFocus />
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-dark text-[12px] font-medium">Password</span>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-coral text-[11px] font-medium hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="border-border text-dark placeholder:text-chrome focus:border-dark rounded-lg border bg-white px-3.5 py-2.5 text-sm focus:outline-none"
                    />
                  </div>
                  {error && <p className="text-coral text-xs">{error}</p>}
                  {resetSent && (
                    <p className="text-graphite text-xs">
                      Check your email for a password reset link.
                    </p>
                  )}
                  <PrimaryButton type="submit" disabled={!email || password.length < 6 || submitting}>
                    Log In
                  </PrimaryButton>
                </form>
                <p className="text-gray text-center text-[12px]">
                  Don&apos;t have an account?{" "}
                  <button type="button" onClick={() => setStep(0)} className="text-coral font-medium hover:underline">
                    Sign up
                  </button>
                </p>
              </div>
            </>
          )}

          {step === 0 && (
            <>
              <h2 className="text-dark mb-2 text-[22px] font-medium">Create your account</h2>
              <p className="text-gray mb-5 text-[13px]">Start exploring Denver&apos;s best events and deals.</p>
              <div className="flex flex-col gap-3">
                <GoogleButton onClick={handleGoogle} disabled={submitting}>
                  Continue with Google
                </GoogleButton>
                <Divider />
                <form onSubmit={handleSignup} className="flex flex-col gap-3">
                  <Field label="Full Name" value={name} onChange={setName} placeholder="Jane Doe" required autoFocus />
                  <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
                  <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" required />
                  {error && <p className="text-coral text-xs">{error}</p>}
                  {pendingConfirmationEmail && (
                    <p className="text-graphite text-xs">
                      Account created. Check {pendingConfirmationEmail} to
                      confirm your email before signing in.
                    </p>
                  )}
                  <PrimaryButton type="submit" disabled={!name || !email || password.length < 6 || submitting}>
                    Continue
                  </PrimaryButton>
                </form>
                <p className="text-gray text-center text-[12px]">
                  Already have an account?{" "}
                  <button type="button" onClick={() => setStep(-1)} className="text-coral font-medium hover:underline">
                    Log in
                  </button>
                </p>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <button
                type="button"
                onClick={() => setStep(0)}
                className="text-gray mb-3 inline-flex items-center gap-1 text-[13px] font-medium hover:text-dark"
              >
                ← Back
              </button>
              <h2 className="text-dark mb-2 text-[22px] font-medium">Choose your plan</h2>
              <p className="text-gray mb-5 text-[13px]">Start free or unlock the full experience.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => choosePlan("free")}
                  className={`flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-colors ${
                    plan === "free"
                      ? "border-dark bg-[#f9f9f9]"
                      : "border-border hover:border-dark"
                  }`}
                >
                  <div className="text-dark text-[15px] font-medium">Explorer</div>
                  <div className="text-dark text-[22px] font-medium leading-none">
                    $0<span className="text-gray text-[12px] font-normal"> /forever</span>
                  </div>
                  <ul className="text-graphite mt-2 flex flex-col gap-1.5 text-[12px]">
                    {["Browse all events & deals", "Basic filters", "Favorite up to 5 events", "Share with friends"].map((f) => (
                      <li key={f} className="flex items-start gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff535b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
                <button
                  type="button"
                  onClick={() => choosePlan("insider")}
                  className={`relative flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-colors ${
                    plan === "insider"
                      ? "border-coral bg-coral/5"
                      : "border-border hover:border-coral"
                  }`}
                >
                  <span className="bg-coral self-start rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                    Popular
                  </span>
                  <div className="text-dark text-[15px] font-medium">Insider</div>
                  <div className="text-dark text-[22px] font-medium leading-none">
                    $4.99<span className="text-gray text-[12px] font-normal"> /month</span>
                  </div>
                  <ul className="text-graphite mt-2 flex flex-col gap-1.5 text-[12px]">
                    {[
                      "Everything in Explorer, plus:",
                      "Personalized recommendations",
                      "Unlimited saves & calendar sync",
                      "Advanced lifestyle filters",
                      "Exclusive deals (coming soon)",
                    ].map((f, i) => (
                      <li key={f} className="flex items-start gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff535b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className={i === 0 ? "font-medium" : ""}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              </div>
              <button
                type="button"
                onClick={continueFromPlan}
                disabled={!plan}
                className="bg-dark rounded-pill mt-5 w-full py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-gray mb-3 inline-flex items-center gap-1 text-[13px] font-medium hover:text-dark"
              >
                ← Back
              </button>
              <h2 className="text-dark mb-2 text-[22px] font-medium">What are you into?</h2>
              <p className="text-gray text-[13px]">Pick at least 3 to personalize your recommendations.</p>
              <p className="text-coral mb-4 mt-1 text-[12px] font-medium">
                {interests.size} selected ·{" "}
                {interests.size >= 3
                  ? "you're good to go"
                  : `${3 - interests.size} more needed`}
              </p>
              <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ONBOARDING_INTERESTS.map((opt) => {
                  const active = interests.has(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleIn(interests, setInterests, opt.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[13px] transition-colors ${
                        active
                          ? "border-dark bg-[#f9f9f9]"
                          : "border-border hover:border-dark"
                      }`}
                    >
                      <span className="text-base leading-none">{opt.icon}</span>
                      <span className="text-dark flex-1">{opt.label}</span>
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
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={interests.size < 3}
                className="bg-dark rounded-pill w-full py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-gray mt-3 block w-full text-center text-[12px] hover:underline"
              >
                Skip this step
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-gray mb-3 inline-flex items-center gap-1 text-[13px] font-medium hover:text-dark"
              >
                ← Back
              </button>
              <h2 className="text-dark mb-2 text-[22px] font-medium">Your neighborhoods</h2>
              <p className="text-gray mb-4 text-[13px]">Pick at least one you&apos;d like to explore.</p>
              <div className="mb-5 flex flex-wrap gap-2">
                {ONBOARDING_NEIGHBORHOODS.map((name) => {
                  const active = hoods.has(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleIn(hoods, setHoods, name)}
                      className={`rounded-pill border-[1.5px] px-4 py-1.5 text-[12px] font-medium transition-colors ${
                        active ? "border-dark bg-dark text-white" : "border-border text-graphite hover:border-dark"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setStep(5)}
                disabled={hoods.size < 1}
                className="bg-dark rounded-pill w-full py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="text-gray mt-3 block w-full text-center text-[12px] hover:underline"
              >
                Skip this step
              </button>
            </>
          )}

          {step === 5 && (
            <>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-gray mb-3 inline-flex items-center gap-1 text-[13px] font-medium hover:text-dark"
              >
                ← Back
              </button>
              <h2 className="text-dark mb-2 text-[22px] font-medium">Your lifestyle</h2>
              <p className="text-gray mb-4 text-[13px]">Help us tailor the best events for you.</p>
              <div className="mb-5 flex flex-col gap-1.5">
                {LIFESTYLE_OPTIONS.map((opt) => {
                  const active = lifestyle.has(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleIn(lifestyle, setLifestyle, opt.id)}
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
              <button
                type="button"
                onClick={advanceInsider}
                disabled={submitting}
                className="bg-dark rounded-pill w-full py-3 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {submitting
                  ? "Redirecting to checkout…"
                  : plan === "insider"
                    ? "Continue to checkout"
                    : "Continue"}
              </button>
              <button
                type="button"
                onClick={advanceInsider}
                disabled={submitting}
                className="text-gray mt-3 block w-full text-center text-[12px] hover:underline disabled:opacity-60"
              >
                Skip for now
              </button>
              {error && (
                <p className="text-coral mt-2 text-center text-[12px]">
                  {error}
                </p>
              )}
            </>
          )}

          {step === 6 && (
            <>
              <div className="mb-5 flex justify-center">
                <div className="bg-coral/10 flex h-16 w-16 items-center justify-center rounded-full">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff535b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <h2 className="text-dark mb-2 text-center text-[22px] font-medium">You&apos;re in!</h2>
              <p className="text-graphite mb-6 text-center text-[14px]">
                {plan === "insider"
                  ? "Welcome to Wundervue Insider. Your personalized Denver picks are ready."
                  : "Welcome to Wundervue. Start exploring Denver's best events and deals."}
              </p>
              <PrimaryButton onClick={close} className="w-full">
                Start Exploring Denver
              </PrimaryButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
