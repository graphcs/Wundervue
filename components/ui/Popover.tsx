"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// The down-chevron every dropdown trigger shows; flips when the menu is open.
export function DropdownChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

interface TriggerArgs {
  open: boolean;
  toggle: (e: ReactMouseEvent<HTMLElement>) => void;
}

interface Props {
  /** The clickable trigger (usually a Pill). Gets the open state + a toggle. */
  trigger: (args: TriggerArgs) => ReactNode;
  /** The menu body. Gets a `close` so option clicks can dismiss the popover. */
  children: (close: () => void) => ReactNode;
  /** Visual classes for the menu (width, max-height, border, bg…). Positioning
   *  is owned by the popover. */
  panelClassName?: string;
}

// Anchored popover whose menu is portaled to <body> and positioned with fixed
// coordinates from the trigger's rect. Portaling lets the menu escape ancestor
// `overflow` (e.g. the mobile horizontal scroll row) and any transforms, so it
// never gets clipped. Centralizes the open-state + click-outside + Escape logic
// that each dropdown used to re-implement.
export function Popover({ trigger, children, panelClassName = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);
  // Capture the trigger's rect from the click event (not a ref/effect), then
  // open. Coordinates are fixed once, so we dismiss on scroll/resize below.
  const toggle = (e: ReactMouseEvent<HTMLElement>) => {
    if (!open) {
      const r = e.currentTarget.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  };

  // Dismiss on scroll/resize (the menu is positioned once and doesn't chase).
  useEffect(() => {
    if (!open) return;
    // Scroll fires on the capture phase, so a scroll *inside* the menu's own
    // overflow list reaches this window listener too — ignore those, or a tall
    // dropdown (Location/Category/Lifestyle) closes the moment you scroll it.
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Once the menu has a measured width, clamp it into the viewport. Measuring
  // the rendered panel then repositioning is the intended use of a layout pass;
  // the guard makes it a one-shot adjustment (no setState loop).
  useEffect(() => {
    if (!open || !pos) return;
    const pw = panelRef.current?.offsetWidth ?? 0;
    const maxLeft = window.innerWidth - pw - 8;
    if (pw && pos.left > maxLeft) {
      setPos((p) => (p ? { ...p, left: Math.max(8, maxLeft) } : p));
    }
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={anchorRef} className="relative">
      {trigger({ open, toggle })}
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 70 }}
            className={panelClassName}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </div>
  );
}
