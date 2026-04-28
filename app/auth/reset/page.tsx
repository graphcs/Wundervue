"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // Only the PASSWORD_RECOVERY event unlocks the form. Checking
    // getSession() here would also accept regular sessions, letting any
    // signed-in user change their password without re-auth.
    const { data: sub } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw new Error(updateErr.message);
      // Sign out the recovery session so it can't be reused as a normal
      // session (e.g. by someone with brief physical access to the email link).
      await supabase.auth.signOut();
      setDone(true);
      setTimeout(() => router.push("/"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-dark text-2xl font-semibold">Reset your password</h1>
        <p className="text-gray text-sm">
          {ready
            ? "Choose a new password for your Wundervue account."
            : "Open this page from the password reset email to continue."}
        </p>
      </div>

      {done ? (
        <p className="text-dark text-sm">
          Password updated. Sign in with your new password to continue.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-dark text-[12px] font-medium">New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              required
              autoFocus
              className="border-border text-dark placeholder:text-chrome focus:border-dark rounded-lg border bg-white px-3.5 py-2.5 text-sm focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={!ready || submitting || password.length < 6}
            className="bg-dark rounded-pill px-6 py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Save new password"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </main>
  );
}
