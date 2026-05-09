"use client";

import { useEffect, useRef, useState } from "react";
import navData from "@/lib/data/wundervue-nav.json";
import { TrendingPanel } from "./TrendingPanel";

const CLOSE_DELAY_MS = 150;
const PANEL_BG = "#fff8e6";

export function TrendingBar() {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setIsOpen(false), CLOSE_DELAY_MS);
  }

  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <div
        className="text-[11px] font-bold uppercase tracking-[0.1em] text-dark"
        style={{
          background: "linear-gradient(130deg, #82ffc5 0%, #94f6ff 80%)",
        }}
      >
        <div className="mx-auto flex h-[38px] max-w-[1100px] items-center justify-between px-7">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            onMouseEnter={() => {
              cancelClose();
              setIsOpen(true);
            }}
            onMouseLeave={scheduleClose}
            onClick={() => setIsOpen((v) => !v)}
            className={`-mb-px flex h-full items-center gap-1.5 px-4 transition-colors ${
              isOpen ? "" : "hover:opacity-70"
            }`}
            style={isOpen ? { background: PANEL_BG } : undefined}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
            TRENDING
          </button>
          <div className="flex items-center gap-4">
            <a
              href={navData.social.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="text-dark transition-opacity hover:opacity-70"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M14.85 4.5c-.3-.04-1.13-.13-2.1-.13-2.08 0-3.5 1.27-3.5 3.6V10H7v3.5h2.25V21h3.5v-7.5h2.25l.35-3.5h-2.6V8.43c0-1 .27-1.7 1.7-1.7h1.4z" />
              </svg>
            </a>
            <a
              href={navData.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-dark transition-opacity hover:opacity-70"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a
              href={navData.social.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-dark transition-opacity hover:opacity-70"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="3" y="9" width="3.5" height="11.5" />
                <circle cx="4.75" cy="5" r="2" />
                <path d="M9.5 9h3.3v1.5h.05c.46-.87 1.6-1.78 3.3-1.78 3.5 0 4.15 2.3 4.15 5.3v6.48h-3.5v-5.34c0-1.27-.02-2.91-1.78-2.91s-2.05 1.39-2.05 2.82v5.43h-3.5z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
      {isOpen && (
        <TrendingPanel
          onClose={() => setIsOpen(false)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </div>
  );
}
