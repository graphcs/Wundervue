"use client";

import { useState } from "react";
import { CenteredModal } from "@/components/account/CenteredModal";
import { REPORT_ISSUE_TYPES, REPORT_NOTE_MAX } from "@/lib/reports";

interface Props {
  open: boolean;
  onClose: () => void;
  listingId: string;
}

type State = "idle" | "submitting" | "done" | "error";

export function ReportIssueModal({ open, onClose, listingId }: Props) {
  const [issueType, setIssueType] = useState("");
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function reset() {
    setIssueType("");
    setNote("");
    setEmail("");
    setState("idle");
    setErrorMsg("");
  }

  function close() {
    onClose();
    // Reset after the close animation/unmount so a reopened modal is fresh.
    reset();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!issueType || state === "submitting") return;
    setState("submitting");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, issueType, note, email }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(j.error ?? "Something went wrong. Please try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  }

  return (
    <CenteredModal open={open} onClose={close} ariaLabel="Report an issue">
      <div className="p-6">
        {state === "done" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <h2 className="text-dark text-lg font-medium">Thanks for the heads-up</h2>
            <p className="text-gray text-sm">
              We&apos;ll review this listing and fix it if needed.
            </p>
            <button
              type="button"
              onClick={close}
              className="bg-dark rounded-pill mt-2 px-6 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <h2 className="text-dark text-lg font-medium">Report an issue</h2>
              <p className="text-gray mt-0.5 text-sm">
                Tell us what&apos;s wrong with this listing.
              </p>
            </div>

            <fieldset className="flex flex-col gap-1.5">
              {REPORT_ISSUE_TYPES.map((o) => (
                <label
                  key={o.id}
                  className="border-border hover:border-dark flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px]"
                >
                  <input
                    type="radio"
                    name="issue"
                    value={o.id}
                    checked={issueType === o.id}
                    onChange={() => setIssueType(o.id)}
                    className="accent-coral"
                  />
                  <span className="text-dark">{o.label}</span>
                </label>
              ))}
            </fieldset>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add details (optional)"
              maxLength={REPORT_NOTE_MAX}
              rows={3}
              className="border-border focus:border-dark rounded-lg border px-3 py-2 text-[13px] outline-none"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email (optional, if you'd like a reply)"
              className="border-border focus:border-dark rounded-lg border px-3 py-2 text-[13px] outline-none"
            />

            {state === "error" && (
              <p className="text-coral text-[13px]">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={!issueType || state === "submitting"}
              className="bg-dark rounded-pill px-6 py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {state === "submitting" ? "Sending…" : "Submit report"}
            </button>
          </form>
        )}
      </div>
    </CenteredModal>
  );
}
