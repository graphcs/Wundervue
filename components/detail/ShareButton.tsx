"use client";

import { useState } from "react";
import type { Listing } from "@/lib/types";
import { buildShareUrl } from "@/lib/links";
import { ShareIcon } from "./icons";

interface Props {
  listing: Listing;
}

export function ShareButton({ listing }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    const url = buildShareUrl(listing);
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: listing.title,
          text: listing.description,
          url,
        });
        return;
      }
    } catch {
      // user cancelled or share failed — fall through to copy
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-pill border-dark text-dark hover:bg-dark flex-1 border-[1.5px] px-4 py-3 text-[13px] font-medium transition-colors hover:text-white"
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        <ShareIcon size={14} />
        {copied ? "Copied!" : "Share"}
      </span>
    </button>
  );
}
