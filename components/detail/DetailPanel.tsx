"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Listing } from "@/lib/types";
import { ListingDetailView } from "./ListingDetailView";

interface Props {
  listing: Listing;
}

export function DetailPanel({ listing }: Props) {
  const router = useRouter();

  const close = () => router.back();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={close}
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        className="relative z-10 h-full w-full max-w-[440px] animate-[slide-in_0.25s_ease-out] overflow-y-auto bg-white shadow-2xl"
        style={{
          animationName: "slide-in",
          animationDuration: "0.25s",
          animationTimingFunction: "ease-out",
        }}
      >
        <style>{`
          @keyframes slide-in {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>
        <ListingDetailView listing={listing} variant="panel" onClose={close} />
      </aside>
    </div>
  );
}
