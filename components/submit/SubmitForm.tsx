"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  SUBMISSION_KINDS,
  TITLE_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  EMAIL_MAX,
  URL_MAX,
  SHORT_TEXT_MAX,
} from "@/lib/submissions";
import { FormField, inputClass } from "@/components/forms/FormField";

type Status = "idle" | "submitting" | "done" | "error";

export function SubmitForm() {
  const [kind, setKind] = useState<string>("event");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venueName, setVenueName] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please add a title.");
      return;
    }
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, description, venueName, neighborhood, eventDate, url, name, email }),
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
        <h2 className="text-dark text-[18px] font-medium">Thanks for the submission!</h2>
        <p className="text-gray mx-auto mt-1.5 max-w-md text-[14px]">
          Our team reviews every submission before it goes live. We&apos;ll take it from here.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setTitle("");
              setDescription("");
              setVenueName("");
              setNeighborhood("");
              setEventDate("");
              setUrl("");
              setStatus("idle");
            }}
            className="bg-dark rounded-pill px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
          >
            Submit another
          </button>
          <Link
            href="/explore"
            className="border-border rounded-pill border px-5 py-2.5 text-[13px] font-medium hover:bg-tag-bg"
          >
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="border-border flex flex-col gap-4 rounded-2xl border bg-white p-6">
      <FormField label="What are you submitting?">
        <div className="flex gap-2">
          {SUBMISSION_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={`rounded-pill border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                kind === k.id ? "bg-dark border-dark text-white" : "border-border text-graphite hover:text-dark"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Title" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} className={inputClass} placeholder="e.g. Summer Night Market" />
      </FormField>

      <FormField label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={DESCRIPTION_MAX} rows={4} className={inputClass} placeholder="Tell us what's happening…" />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Venue or business">
          <input value={venueName} onChange={(e) => setVenueName(e.target.value)} maxLength={SHORT_TEXT_MAX} className={inputClass} placeholder="Where is it?" />
        </FormField>
        <FormField label="Neighborhood">
          <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} maxLength={SHORT_TEXT_MAX} className={inputClass} placeholder="e.g. RiNo" />
        </FormField>
        <FormField label="Date & time">
          <input value={eventDate} onChange={(e) => setEventDate(e.target.value)} maxLength={SHORT_TEXT_MAX} className={inputClass} placeholder="e.g. Sat, Jun 14, 7pm" />
        </FormField>
        <FormField label="Link" hint="Website, ticket page, or social post">
          <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={URL_MAX} className={inputClass} placeholder="https://" />
        </FormField>
      </div>

      <div className="border-border grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
        <FormField label="Your name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} className={inputClass} />
        </FormField>
        <FormField label="Your email" hint="So we can follow up if needed">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={EMAIL_MAX} className={inputClass} />
        </FormField>
      </div>

      {error && <p className="text-coral text-[13px]">{error}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="bg-dark rounded-pill self-start px-6 py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {status === "submitting" ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
