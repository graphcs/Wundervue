import type { ReactNode } from "react";

// Shared input styling for the public Submit / Work With Us forms (matches the
// account page inputs).
export const inputClass =
  "border-border focus:border-dark w-full rounded-lg border px-3 py-2 text-sm focus:outline-none";

export function FormField({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-dark text-[12px] font-medium">
        {label}
        {required && <span className="text-coral"> *</span>}
      </span>
      {children}
      {hint && <span className="text-gray text-[11px]">{hint}</span>}
    </label>
  );
}
