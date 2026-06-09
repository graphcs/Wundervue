import type { Metadata } from "next";
import { WorkWithUsForm } from "@/components/submit/WorkWithUsForm";

export const metadata: Metadata = {
  title: "Work With Us — Wundervue",
  description:
    "Partner, advertise, or collaborate with Wundervue to reach Denver locals. Tell us what you have in mind.",
};

export default function WorkWithUsPage() {
  return (
    <div className="mx-auto max-w-[680px] px-5 py-10 sm:px-7">
      <header className="mb-6">
        <h1 className="text-dark text-[28px] font-medium leading-tight">Work with us</h1>
        <p className="text-gray mt-1.5 text-[14px]">
          Want to partner, advertise, or get your venue in front of Denver locals? We&apos;d love to hear from you.
        </p>
      </header>
      <WorkWithUsForm />
    </div>
  );
}
