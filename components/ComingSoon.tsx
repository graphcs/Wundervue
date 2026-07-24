import Link from "next/link";

// Lightweight placeholder for nav destinations that don't have content yet
// (Stories, About, Get The App).
export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="mx-auto max-w-[600px] px-4 py-16 text-center sm:px-7 sm:py-24">
      <h1 className="text-dark text-[24px] font-medium sm:text-[28px]">{title}</h1>
      <p className="text-gray mx-auto mt-3 max-w-md text-[15px]">{blurb}</p>
      <Link
        href="/"
        className="bg-dark rounded-pill mt-7 inline-block px-6 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
      >
        Back to events
      </Link>
    </div>
  );
}
