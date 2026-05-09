"use client";

import { useEffect, useRef, useState } from "react";
import { ProfileIcon } from "./ProfileIcon";
import { SpotlightsPanel } from "./SpotlightsPanel";
import navData from "@/lib/data/wundervue-nav.json";

const CLOSE_DELAY_MS = 150;
const PANEL_BG = "#fff8e6";

// Top-level nav items that open a custom panel (not the JSON-driven
// dropdown of links). Hover/click matches the dropdown UX, but the
// rendered panel is a separate component.
const SPOTLIGHTS_LABEL = "Spotlights";

export function NavBar() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
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
    closeTimer.current = setTimeout(() => setOpenIndex(null), CLOSE_DELAY_MS);
  }

  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (openIndex === null) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenIndex(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openIndex]);

  const openLink = openIndex !== null ? navData.nav[openIndex] : null;
  const openDropdown =
    openLink && openLink.children.length > 0 && openLink.label !== SPOTLIGHTS_LABEL
      ? openLink
      : null;
  const spotlightsOpen = openLink?.label === SPOTLIGHTS_LABEL;

  return (
    <div ref={rootRef} className="relative">
      <nav className="border-border relative flex items-center justify-center border-b px-4 py-3">
        <ul className="flex items-center gap-8">
          {navData.nav.map((link, i) => {
            const isSpotlights = link.label === SPOTLIGHTS_LABEL;
            const hasDropdown = link.children.length > 0 && !isSpotlights;
            const isOpen = openIndex === i && (hasDropdown || isSpotlights);
            return (
              <li key={link.label} className="relative">
                {hasDropdown ? (
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    onMouseEnter={() => {
                      cancelClose();
                      setOpenIndex(i);
                    }}
                    onMouseLeave={scheduleClose}
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className={`text-dark relative flex items-center gap-1 py-1 text-[11px] font-bold uppercase tracking-[0.08em] transition-opacity ${
                      isOpen ? "opacity-100" : "hover:opacity-70"
                    }`}
                  >
                    {link.label}
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                      className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {isOpen && (
                      <span
                        aria-hidden="true"
                        className="bg-chrome absolute -bottom-[13px] left-1/2 h-[2px] w-[80%] -translate-x-1/2"
                      />
                    )}
                  </button>
                ) : isSpotlights ? (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    onMouseEnter={() => {
                      cancelClose();
                      setOpenIndex(i);
                    }}
                    onMouseLeave={scheduleClose}
                    className={`text-dark relative inline-flex items-center py-1 text-[11px] font-bold uppercase tracking-[0.08em] transition-opacity ${
                      isOpen ? "opacity-100" : "hover:opacity-70"
                    }`}
                  >
                    {link.label}
                    {isOpen && (
                      <span
                        aria-hidden="true"
                        className="bg-chrome absolute -bottom-[13px] left-1/2 h-[2px] w-[80%] -translate-x-1/2"
                      />
                    )}
                  </a>
                ) : (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-dark text-[11px] font-bold uppercase tracking-[0.08em] hover:opacity-70"
                  >
                    {link.label}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <ProfileIcon />
        </div>
      </nav>
      {openDropdown && (
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="mx-auto max-w-[1100px] px-7"
        >
          <div
            role="menu"
            className="flex flex-wrap items-center justify-center gap-x-12 gap-y-3 px-8 py-5"
            style={{ background: PANEL_BG }}
          >
            {openDropdown.children.map((c) => (
              <a
                key={c.href}
                role="menuitem"
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpenIndex(null)}
                className="text-dark text-[13px] font-medium hover:opacity-70"
              >
                {c.label}
              </a>
            ))}
          </div>
        </div>
      )}
      {spotlightsOpen && (
        <SpotlightsPanel
          onClose={() => setOpenIndex(null)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </div>
  );
}
