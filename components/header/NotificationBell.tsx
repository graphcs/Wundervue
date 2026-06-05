"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/hooks/useNotifications";

// One row wrapper: a link when the notification has a deep target, else a button.
function ItemWrapper({ url, onActivate, children }: { url: string | null; onActivate: () => void; children: ReactNode }) {
  const cls = "hover:bg-tag-bg block w-full text-left";
  return url ? (
    <Link href={url} onClick={onActivate} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onActivate} className={cls}>
      {children}
    </button>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function NotificationBell() {
  const { items, unread, refresh, markRead, markAllRead, dismiss, isLoggedIn } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, refresh]);

  if (!isLoggedIn) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="border-border hover:border-dark relative flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] bg-white transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#121821" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="bg-coral absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="border-border absolute right-0 top-[44px] z-50 w-[340px] overflow-hidden rounded-xl border bg-white shadow-xl">
          <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-dark text-[13px] font-semibold">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="text-coral text-[12px] font-medium hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="text-gray px-4 py-10 text-center text-[13px]">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-[60vh] divide-border divide-y overflow-y-auto">
              {items.map((n) => {
                const inner = (
                  <div className="flex items-start gap-2 px-4 py-3">
                    {!n.read_at && <span className="bg-coral mt-1.5 h-2 w-2 shrink-0 rounded-full" aria-hidden />}
                    <div className={`min-w-0 flex-1 ${n.read_at ? "pl-4" : ""}`}>
                      <p className="text-dark text-[13px] font-medium leading-snug">{n.title}</p>
                      {n.body && <p className="text-gray mt-0.5 line-clamp-2 text-[12px]">{n.body}</p>}
                      <p className="text-gray mt-1 text-[11px]">{relativeTime(n.created_at)}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); void dismiss(n.id); }}
                      className="text-gray hover:text-dark shrink-0 text-[14px] leading-none"
                    >
                      ×
                    </button>
                  </div>
                );
                return (
                  <li key={n.id} className={n.read_at ? "" : "bg-tag-bg/40"}>
                    <ItemWrapper
                      url={n.url}
                      onActivate={() => {
                        void markRead(n.id);
                        if (n.url) setOpen(false);
                      }}
                    >
                      {inner}
                    </ItemWrapper>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
