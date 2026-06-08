"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ProfileIcon } from "./ProfileIcon";
import { NotificationBell } from "./NotificationBell";
import { SpotlightsPanel } from "./SpotlightsPanel";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { GET_THE_APP_URL } from "@/lib/constants";
import navData from "@/lib/data/wundervue-nav.json";

const CLOSE_DELAY_MS = 150;
const PANEL_BG = "#fff8e6";

// Top-level item that opens a custom panel instead of a link dropdown.
const SPOTLIGHTS_LABEL = "Spotlights";

interface NavLink {
  label: string;
  href: string;
  children: { label: string; href: string }[];
}

// The nav is composed in code (AllTrails order), pulling the external marketing
// dropdowns from the scraped JSON by label so a re-scrape can't reorder us.
// About is fully internal (our own pages).
const navByLabel = new Map(
  (navData.nav as NavLink[]).map((n) => [n.label, n]),
);
const guides = navByLabel.get("Monthly Guides");
const bestOf = navByLabel.get("Best Of");
const spotlights = navByLabel.get("Spotlights");

const NAV: NavLink[] = [
  { label: "Stories", href: "/stories", children: [] },
  {
    label: "Guides",
    href: guides?.href ?? "https://wundervue.com/category/guides/",
    children: guides?.children ?? [],
  },
  {
    label: "Best Of",
    href: bestOf?.href ?? "https://wundervue.com/category/best-of/",
    children: bestOf?.children ?? [],
  },
  {
    label: "Spotlights",
    href: spotlights?.href ?? "https://wundervue.com/category/spotlights/",
    children: [],
  },
  {
    label: "About",
    href: "/about",
    children: [
      { label: "About Us", href: "/about" },
      { label: "Submissions", href: "/submit" },
      { label: "Work With Us", href: "/work-with-us" },
    ],
  },
];

const isInternal = (href: string) => href.startsWith("/");

const LINK_CLASS =
  "text-dark text-[14px] font-medium hover:text-graphite transition-colors";

export function NavBar() {
  const { isLoggedIn, hydrated, openOnboarding } = useAuthContext();
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

  const openLink = openIndex !== null ? NAV[openIndex] : null;
  const openDropdown =
    openLink && openLink.children.length > 0 && openLink.label !== SPOTLIGHTS_LABEL
      ? openLink
      : null;
  const spotlightsOpen = openLink?.label === SPOTLIGHTS_LABEL;

  return (
    <div ref={rootRef} className="bg-bg border-border relative border-b">
      <nav className="mx-auto flex max-w-[1280px] items-center gap-7 px-6 py-3">
        <Link href="/" aria-label="Wundervue — home" className="inline-block shrink-0">
          <Image
            src="/images/wundervue-logo.webp"
            alt="Wundervue"
            width={194}
            height={62}
            priority
            className="h-[38px] w-auto"
          />
        </Link>

        <ul className="hidden items-center gap-7 lg:flex">
          {NAV.map((link, i) => {
            const isSpotlights = link.label === SPOTLIGHTS_LABEL;
            const hasDropdown = link.children.length > 0 && !isSpotlights;
            const togglesPanel = hasDropdown || isSpotlights;
            const isOpen = openIndex === i && togglesPanel;
            return (
              <li key={link.label} className="relative">
                {togglesPanel ? (
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
                    className={`${LINK_CLASS} flex items-center gap-1`}
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
                  </button>
                ) : isInternal(link.href) ? (
                  <Link href={link.href} className={LINK_CLASS}>
                    {link.label}
                  </Link>
                ) : (
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                    {link.label}
                  </a>
                )}
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-2.5">
          {hydrated && !isLoggedIn && (
            <button
              type="button"
              onClick={() => openOnboarding(0)}
              className="border-border hover:border-dark text-dark rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors"
            >
              Log In
            </button>
          )}
          <a
            href={GET_THE_APP_URL}
            className="bg-coral rounded-pill px-4 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Get The App
          </a>
          <NotificationBell />
          {hydrated && isLoggedIn && <ProfileIcon />}
        </div>
      </nav>

      {openDropdown && (
        <div onMouseEnter={cancelClose} onMouseLeave={scheduleClose} className="mx-auto max-w-[1280px] px-6">
          <div
            role="menu"
            className="flex flex-wrap items-center gap-x-12 gap-y-3 px-8 py-5"
            style={{ background: PANEL_BG }}
          >
            {openDropdown.children.map((c) =>
              isInternal(c.href) ? (
                <Link
                  key={c.href}
                  role="menuitem"
                  href={c.href}
                  onClick={() => setOpenIndex(null)}
                  className="text-dark text-[13px] font-medium hover:opacity-70"
                >
                  {c.label}
                </Link>
              ) : (
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
              ),
            )}
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
