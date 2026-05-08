"use client";

import { useState } from "react";
import trendingData from "@/lib/data/wundervue-trending.json";

type Tab = "now" | "week" | "month";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "now", label: "Now" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

const PANEL_BG = "#fff8e6";
const RANK_BG = "#82ffc5";

type Props = {
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export function TrendingPanel({ onClose, onMouseEnter, onMouseLeave }: Props) {
  const [tab, setTab] = useState<Tab>("now");
  const items = trendingData[tab];

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
          <h2 className="text-dark text-[15px] font-bold uppercase tracking-[0.08em]">
            Trending
          </h2>
          <div className="flex items-center gap-6 text-[11px] font-bold uppercase tracking-[0.08em]">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`text-dark relative pb-1 transition-opacity ${
                  tab === t.key
                    ? "opacity-100 after:bg-dark after:absolute after:-bottom-0.5 after:left-0 after:right-0 after:h-[2px] after:content-['']"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <li key={item.href + i} className="relative">
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="group block"
              >
                <div className="relative overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt=""
                    className="h-[180px] w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  <div
                    className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold"
                    style={{ background: RANK_BG, color: "#0e7a9a" }}
                    aria-hidden="true"
                  >
                    {item.rank}
                  </div>
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
