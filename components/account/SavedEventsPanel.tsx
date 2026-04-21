"use client";

import Link from "next/link";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { LISTINGS } from "@/lib/data/listings";
import { Badge } from "@/components/ui/Badge";
import { FreeBadge } from "@/components/ui/FreeBadge";
import { DealTag } from "@/components/ui/DealTag";
import { SlideOver } from "./SlideOver";

function HeartIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="#ff535b"
      stroke="#ff535b"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function SavedEventsPanel() {
  const { savedEventsOpen, closeSavedEvents, profile } = useAuthContext();
  const { favorites, toggle } = useFavorites();
  const saved = LISTINGS.filter((l) => favorites.has(l.id));

  return (
    <SlideOver
      open={savedEventsOpen}
      onClose={closeSavedEvents}
      title="Saved Events"
      subtitle={`${saved.length} ${saved.length === 1 ? "item" : "items"}`}
    >
      {saved.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <div className="bg-tag-bg flex h-14 w-14 items-center justify-center rounded-full">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#86898a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h3 className="text-dark text-[15px] font-medium">
            No saved events yet
          </h3>
          <p className="text-gray max-w-[260px] text-[13px]">
            Tap the heart on any event or deal to save it here for later.
          </p>
          <Link
            href="/explore"
            onClick={closeSavedEvents}
            className="bg-dark rounded-pill mt-2 px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
          >
            Browse Events
          </Link>
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {saved.map((l) => {
            const href =
              l.type === "deal" ? `/deals/${l.slug}` : `/events/${l.slug}`;
            return (
              <li key={l.id} className="flex gap-3 px-5 py-3">
                <Link
                  href={href}
                  onClick={closeSavedEvents}
                  className="group flex flex-1 gap-3"
                >
                  <div className="bg-tag-bg relative h-[80px] w-[100px] shrink-0 overflow-hidden rounded-md">
                    <Badge type={l.type} size="sm" />
                    {l.isFree && <FreeBadge size="sm" />}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={l.imageUrl}
                      alt={l.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap gap-1">
                      <span className="bg-tag-bg text-graphite rounded-full px-2 py-0.5 text-[10px] font-medium">
                        {l.neighborhood}
                      </span>
                      {l.dealValue && <DealTag value={l.dealValue} />}
                    </div>
                    <h3 className="text-dark line-clamp-2 text-[13px] font-medium leading-tight">
                      {l.title}
                    </h3>
                    <p className="text-gray text-[11px]">
                      {l.dateDisplay} · {l.venueName}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  aria-label="Remove from saved"
                  onClick={() => toggle(l.id, { plan: profile?.plan })}
                  className="hover:bg-tag-bg flex h-8 w-8 items-center justify-center self-center rounded-full transition-colors"
                >
                  <HeartIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SlideOver>
  );
}
