"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ProfileIcon } from "./ProfileIcon";
import { NotificationBell } from "./NotificationBell";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { GET_THE_APP_URL } from "@/lib/constants";
import navData from "@/lib/data/wundervue-nav.json";

const CLOSE_DELAY_MS = 150;
const PANEL_BG = "#fff8e6";

interface NavLink {
  label: string;
  href: string;
  children: { label: string; href: string }[];
}
interface ChildLink {
  label: string;
  href: string;
}
interface MenuSection {
  label: string;
  href: string;
  links: ChildLink[];
}

// External marketing links are pulled from the scraped JSON by label so a
// re-scrape can't reorder us.
const navByLabel = new Map(
  (navData.nav as NavLink[]).map((n) => [n.label, n]),
);
const guides = navByLabel.get("Monthly Guides");
const bestOf = navByLabel.get("Best Of");
const spotlights = navByLabel.get("Spotlights");

// "Stories" is the umbrella: Guides and Best Of each open their own submenu.
// Spotlights has no sub-links, so it links straight to the website.
const STORIES_SECTIONS: MenuSection[] = [
  {
    label: "Guides",
    href: guides?.href ?? "https://wundervue.com/category/guides/",
    links: guides?.children ?? [],
  },
  {
    label: "Best Of",
    href: bestOf?.href ?? "https://wundervue.com/category/best-of/",
    links: bestOf?.children ?? [],
  },
  {
    // Spotlights has no submenu — it links straight to the website.
    label: "Spotlights",
    href: spotlights?.href ?? "https://wundervue.com/category/spotlights/",
    links: [],
  },
];

const ABOUT_CHILDREN: ChildLink[] = [
  { label: "About Us", href: "/about" },
  { label: "Submissions", href: "/submit" },
  { label: "Work With Us", href: "/work-with-us" },
];

// Top-level (right-aligned) items. Stories cascades into per-section submenus;
// About is a flat dropdown.
type TopItem =
  | { label: string; kind: "stories" }
  | { label: string; kind: "flat"; children: ChildLink[] };

const NAV: TopItem[] = [
  { label: "Stories", kind: "stories" },
  { label: "About", kind: "flat", children: ABOUT_CHILDREN },
];

const isInternal = (href: string) => href.startsWith("/");

const LINK_CLASS =
  "text-dark text-[14px] font-medium hover:text-graphite transition-colors";

function Chevron({ open, dir = "down" }: { open?: boolean; dir?: "down" | "right" }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className={`transition-transform ${dir === "down" && open ? "rotate-180" : ""}`}
    >
      <path d={dir === "down" ? "M3 5l3 3 3-3" : "M4 3l3 3-3 3"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChildAnchor({ link, onClick, className }: { link: ChildLink; onClick: () => void; className: string }) {
  return isInternal(link.href) ? (
    <Link href={link.href} role="menuitem" onClick={onClick} className={className}>
      {link.label}
    </Link>
  ) : (
    <a href={link.href} role="menuitem" target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
      {link.label}
    </a>
  );
}

// No overflow-hidden here: the Stories panel must let its left-flyout submenus
// escape its box. Leaf panels (About, the flyout) add overflow-hidden themselves.
const MENU_PANEL = "border-border absolute z-50 rounded-lg border shadow-lg";
const MENU_ITEM = "text-dark hover:bg-tag-bg block px-4 py-2.5 text-[13px] font-medium whitespace-nowrap";

export function NavBar() {
  const { isLoggedIn, hydrated, openOnboarding } = useAuthContext();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [openSection, setOpenSection] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Mobile accordion: which top item (Stories/About) and which sub-section
  // (Guides/Best Of) are expanded. Keyed by label; single-open at each level.
  const [mobileTop, setMobileTop] = useState<string | null>(null);
  const [mobileSub, setMobileSub] = useState<string | null>(null);
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
    closeTimer.current = setTimeout(() => {
      setOpenIndex(null);
      setOpenSection(null);
    }, CLOSE_DELAY_MS);
  }
  function openTop(i: number) {
    cancelClose();
    setOpenIndex(i);
    setOpenSection(null);
  }
  function closeAll() {
    setOpenIndex(null);
    setOpenSection(null);
  }
  // Close the mobile drawer and collapse every accordion level.
  function closeMobile() {
    setMobileOpen(false);
    setMobileTop(null);
    setMobileSub(null);
  }
  function toggleMobileTop(label: string) {
    setMobileTop((prev) => (prev === label ? null : label));
    setMobileSub(null);
  }
  function toggleMobileSub(label: string) {
    setMobileSub((prev) => (prev === label ? null : label));
  }

  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (openIndex === null && !mobileOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeAll();
        closeMobile();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeAll();
        closeMobile();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openIndex, mobileOpen]);

  return (
    <div ref={rootRef} className="bg-bg border-border relative border-b">
      <nav className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6">
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

        {/* Everything else hugs the right edge: nav first, then the CTA cluster. */}
        <div className="ml-auto flex items-center gap-3 lg:gap-7">
          <ul className="hidden items-center gap-7 lg:flex">
            {NAV.map((item, i) => {
              const isOpen = openIndex === i;
              return (
                <li
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => openTop(i)}
                  onMouseLeave={scheduleClose}
                >
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    onClick={() => (isOpen ? closeAll() : openTop(i))}
                    className={`${LINK_CLASS} flex items-center gap-1`}
                  >
                    {item.label}
                    <Chevron open={isOpen} />
                  </button>

                  {isOpen && item.kind === "flat" && (
                    <div role="menu" className={`${MENU_PANEL} right-0 top-full mt-2 min-w-[180px] overflow-hidden`} style={{ background: PANEL_BG }}>
                      {item.children.map((c) => (
                        <ChildAnchor key={c.href} link={c} onClick={closeAll} className={MENU_ITEM} />
                      ))}
                    </div>
                  )}

                  {isOpen && item.kind === "stories" && (
                    <div role="menu" className={`${MENU_PANEL} right-0 top-full mt-2 min-w-[190px] py-1`} style={{ background: PANEL_BG }}>
                      {STORIES_SECTIONS.map((section, si) => {
                        const subOpen = openSection === si;
                        // A section with no sub-links is a plain link (e.g.
                        // Spotlights → the website), not a cascading submenu.
                        if (section.links.length === 0) {
                          return (
                            <div key={section.label} onMouseEnter={() => { cancelClose(); setOpenSection(null); }}>
                              <ChildAnchor link={{ label: section.label, href: section.href }} onClick={closeAll} className={MENU_ITEM} />
                            </div>
                          );
                        }
                        return (
                          <div
                            key={section.label}
                            className="relative"
                            onMouseEnter={() => {
                              cancelClose();
                              setOpenSection(si);
                            }}
                          >
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={subOpen}
                              onClick={() => setOpenSection(subOpen ? null : si)}
                              className={`${MENU_ITEM} flex w-full items-center justify-between gap-3 ${subOpen ? "bg-tag-bg" : ""}`}
                            >
                              {section.label}
                              <Chevron dir="right" />
                            </button>
                            {subOpen && (
                              // Flyout opens to the LEFT so it never clips off the
                              // right edge under the right-aligned nav.
                              <div role="menu" className={`${MENU_PANEL} right-full top-0 mr-1 min-w-[210px] max-w-[280px] overflow-hidden`} style={{ background: PANEL_BG }}>
                                {section.links.map((c) => (
                                  <ChildAnchor key={c.href} link={c} onClick={closeAll} className={MENU_ITEM} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2.5">
            {hydrated && !isLoggedIn && (
              <button
                type="button"
                onClick={() => openOnboarding(0)}
                className="border-border hover:border-dark text-dark hidden rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors lg:inline-block"
              >
                Log In
              </button>
            )}
            <a
              href={GET_THE_APP_URL}
              className="bg-coral rounded-pill hidden px-4 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90 lg:inline-block"
            >
              Get The App
            </a>
            <NotificationBell />
            {hydrated && isLoggedIn && <ProfileIcon />}
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={mobileOpen}
              onClick={() => (mobileOpen ? closeMobile() : setMobileOpen(true))}
              className="text-dark hover:text-graphite -mr-1 inline-flex h-9 w-9 items-center justify-center lg:hidden"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {mobileOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <>
                    <path d="M3 6h18" />
                    <path d="M3 12h18" />
                    <path d="M3 18h18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="lg:hidden" style={{ background: PANEL_BG }}>
          <div className="mx-auto max-w-[1280px] px-4 py-2">
            {/* Accordion mirroring the desktop tree: each top item expands to its
                sections; Guides/Best Of expand again to their category links. */}
            <ul className="flex flex-col">
              {NAV.map((item) => {
                const topOpen = mobileTop === item.label;
                return (
                  <li key={item.label} className="border-border/60 border-b">
                    <button
                      type="button"
                      aria-expanded={topOpen}
                      onClick={() => toggleMobileTop(item.label)}
                      className="text-dark flex w-full items-center justify-between py-3 text-[15px] font-semibold"
                    >
                      {item.label}
                      <Chevron open={topOpen} />
                    </button>

                    {topOpen && item.kind === "flat" && (
                      <div className="pb-2">
                        {item.children.map((c) => (
                          <ChildAnchor
                            key={c.href}
                            link={c}
                            onClick={closeMobile}
                            className="text-dark block py-2 pl-3 text-[14px] font-medium"
                          />
                        ))}
                      </div>
                    )}

                    {topOpen && item.kind === "stories" && (
                      <div className="pb-2">
                        {STORIES_SECTIONS.map((section) => {
                          // No sub-links (Spotlights) → a plain indented link.
                          if (section.links.length === 0) {
                            return (
                              <ChildAnchor
                                key={section.label}
                                link={{ label: section.label, href: section.href }}
                                onClick={closeMobile}
                                className="text-dark block py-2 pl-3 text-[14px] font-medium"
                              />
                            );
                          }
                          const subOpen = mobileSub === section.label;
                          return (
                            <div key={section.label}>
                              <button
                                type="button"
                                aria-expanded={subOpen}
                                onClick={() => toggleMobileSub(section.label)}
                                className="text-dark flex w-full items-center justify-between py-2 pl-3 text-[14px] font-medium"
                              >
                                {section.label}
                                <Chevron open={subOpen} />
                              </button>
                              {subOpen && (
                                <div className="pb-1">
                                  {section.links.map((c) => (
                                    <ChildAnchor
                                      key={c.href}
                                      link={c}
                                      onClick={closeMobile}
                                      className="text-gray block py-2 pl-6 text-[14px]"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}

              {hydrated && !isLoggedIn && (
                <li className="border-border/60 border-b">
                  <button
                    type="button"
                    onClick={() => {
                      closeMobile();
                      openOnboarding(0);
                    }}
                    className="text-dark block w-full py-3 text-left text-[15px] font-semibold"
                  >
                    Log In
                  </button>
                </li>
              )}
            </ul>

            {/* Primary CTA lives here on mobile — it's hidden from the crowded
                top bar (visible only at lg+, where the hamburger disappears). */}
            <a
              href={GET_THE_APP_URL}
              onClick={closeMobile}
              className="bg-coral rounded-pill mt-3 mb-1 block px-4 py-2.5 text-center text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            >
              Get The App
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
