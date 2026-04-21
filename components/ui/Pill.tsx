"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

export const Pill = forwardRef<HTMLButtonElement, PillProps>(function Pill(
  { active = false, children, className = "", ...rest },
  ref,
) {
  const activeClasses = active
    ? "bg-dark text-white border-dark"
    : "bg-white text-graphite border-[#d0d0d0] hover:border-dark hover:text-dark";
  return (
    <button
      ref={ref}
      type="button"
      className={`rounded-pill inline-flex items-center gap-1 whitespace-nowrap border-[1.5px] px-4 py-1.5 text-[12px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${activeClasses} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
