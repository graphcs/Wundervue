import type { Metadata } from "next";
import { SubmitForm } from "@/components/submit/SubmitForm";

export const metadata: Metadata = {
  title: "Submit an Event or Deal — Wundervue",
  description:
    "Know about a Denver event or deal we should feature? Submit it to Wundervue — our team reviews every submission.",
};

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-[680px] px-5 py-10 sm:px-7">
      <header className="mb-6">
        <h1 className="text-dark text-[28px] font-medium leading-tight">Submit an event or deal</h1>
        <p className="text-gray mt-1.5 text-[14px]">
          Spot something great happening in Denver? Send it our way. We review every submission before it goes live.
        </p>
      </header>
      <SubmitForm />
    </div>
  );
}
