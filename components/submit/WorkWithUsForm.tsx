"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { INQUIRY_TYPES, NAME_MAX, EMAIL_MAX, SHORT_TEXT_MAX, MESSAGE_MAX } from "@/lib/submissions";
import { FormField, inputClass } from "@/components/forms/FormField";

type Status = "idle" | "submitting" | "done" | "error";

export function WorkWithUsForm() {
  const [inquiryType, setInquiryType] = useState<string>("partnership");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email, and message.");
      return;
    }
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/work-with-us", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryType, name, email, company, message }),
      });
      if (res.ok) {
        setStatus("done");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="border-border rounded-2xl border bg-white p-8 text-center">
        <h2 className="text-dark text-[18px] font-medium">Thanks for reaching out!</h2>
        <p className="text-gray mx-auto mt-1.5 max-w-md text-[14px]">
          We&apos;ll review your inquiry and get back to you at {email}.
        </p>
        <Link
          href="/explore"
          className="bg-dark rounded-pill mt-5 inline-block px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
        >
          Back to Explore
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="border-border flex flex-col gap-4 rounded-2xl border bg-white p-6">
      <FormField label="What's this about?">
        <div className="flex flex-wrap gap-2">
          {INQUIRY_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setInquiryType(t.id)}
              className={`rounded-pill border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                inquiryType === t.id ? "bg-dark border-dark text-white" : "border-border text-graphite hover:text-dark"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} className={inputClass} />
        </FormField>
        <FormField label="Email" required>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={EMAIL_MAX} className={inputClass} />
        </FormField>
      </div>

      <FormField label="Company or organization">
        <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={SHORT_TEXT_MAX} className={inputClass} />
      </FormField>

      <FormField label="Message" required>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={MESSAGE_MAX} rows={5} className={inputClass} placeholder="Tell us how you'd like to work together…" />
      </FormField>

      {error && <p className="text-coral text-[13px]">{error}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="bg-dark rounded-pill self-start px-6 py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {status === "submitting" ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}
