"use client";

import { useState } from "react";
import spotlightsData from "@/lib/data/wundervue-spotlights.json";

const PANEL_BG = "#fff8e6";
const PER_PAGE = 3;

type Props = {
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export function SpotlightsPanel({ onClose, onMouseEnter, onMouseLeave }: Props) {
  const totalPages = Math.ceil(spotlightsData.items.length / PER_PAGE);
  const [page, setPage] = useState(0);
  const visible = spotlightsData.items.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="mx-auto max-w-[1100px] px-7"
    >
      <div
        role="menu"
        className="px-8 py-6"
        style={{ background: PANEL_BG }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-dark text-[22px] font-medium leading-tight">
            Spotlights
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous spotlights"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="border-border flex h-7 w-8 items-center justify-center rounded border bg-white text-dark transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next spotlights"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="border-border flex h-7 w-8 items-center justify-center rounded border bg-white text-dark transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="group block"
              >
                <div className="overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt=""
                    className="h-[180px] w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-dark mt-3 text-[14px] font-medium leading-snug group-hover:underline">
                  {item.title}
                </h3>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
