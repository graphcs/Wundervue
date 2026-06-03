"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Listing } from "@/lib/types";

interface Props {
  listings: Listing[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const FULL_WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const MAX_PREVIEW = 3;

function detailHref(l: Listing): string {
  return l.type === "deal" ? `/deals/${l.slug}` : `/events/${l.slug}`;
}

// Local YYYY-MM-DD key for a Date.
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function FreePill() {
  return (
    <span className="bg-coral rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
      Free
    </span>
  );
}

export function CalendarView({ listings }: Props) {
  // Map each day → its listings. Multi-day events appear on each day they span.
  const byDay = useMemo(() => {
    const map = new Map<string, Listing[]>();
    for (const l of listings) {
      if (!l.startAt) continue;
      const start = new Date(l.startAt);
      if (Number.isNaN(start.getTime())) continue;
      const end = l.endAt && !Number.isNaN(Date.parse(l.endAt)) ? new Date(l.endAt) : start;
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      let guard = 0;
      while (cursor <= last && guard < 366) {
        const key = dayKey(cursor);
        const arr = map.get(key);
        if (arr) arr.push(l);
        else map.set(key, [l]);
        cursor.setDate(cursor.getDate() + 1);
        guard++;
      }
    }
    return map;
  }, [listings]);

  // Soonest day that actually has events — drives the initial month + selection.
  const soonestKey = useMemo(() => {
    let min = Infinity;
    for (const l of listings) {
      const t = l.startAt ? Date.parse(l.startAt) : NaN;
      if (!Number.isNaN(t) && t < min) min = t;
    }
    return Number.isFinite(min) ? dayKey(new Date(min)) : null;
  }, [listings]);

  const initialMonth = useMemo(() => {
    const d = soonestKey ? new Date(`${soonestKey}T00:00:00`) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [soonestKey]);

  const [{ year, month }, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState<string | null>(soonestKey);

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const cells: Array<number | null> = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = dayKey(new Date());
  const selectedItems = selected ? (byDay.get(selected) ?? []) : [];
  const selectedDate = selected ? new Date(`${selected}T00:00:00`) : null;

  const go = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div>
      <div className="border-border overflow-hidden rounded-xl border bg-white">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-dark text-[15px] font-semibold">
            {MONTHS[month]} {year}
          </h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => go(-1)} aria-label="Previous month" className="hover:bg-tag-bg text-graphite flex h-8 w-8 items-center justify-center rounded-full">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button type="button" onClick={() => setMonth(initialMonth)} className="text-graphite hover:text-dark rounded-pill px-3 py-1 text-[12px] font-medium">
              Today
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next month" className="hover:bg-tag-bg text-graphite flex h-8 w-8 items-center justify-center rounded-full">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-graphite px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`b${i}`} className="border-border min-h-[108px] border-b border-r bg-[#fafafa]" />;
            }
            const key = dayKey(new Date(year, month, day));
            const items = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isSelected = key === selected;
            return (
              <button
                type="button"
                key={key}
                onClick={() => setSelected(key)}
                className={`min-h-[108px] cursor-pointer border-b border-r border-border p-1.5 text-left align-top transition-colors hover:bg-[#fafafa] ${
                  isSelected ? "ring-coral z-10 ring-2 ring-inset" : ""
                }`}
              >
                <div className="mb-1 flex items-start justify-between">
                  <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[12px] ${isToday ? "bg-dark font-semibold text-white" : "text-graphite"}`}>
                    {day}
                  </span>
                  {items.length > 0 && (
                    <span className="text-gray text-[10px] font-medium">{items.length}</span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  {items.slice(0, MAX_PREVIEW).map((l) => (
                    <span
                      key={l.id}
                      title={l.title}
                      className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight ${
                        l.type === "deal" ? "bg-coral/15 text-coral" : "bg-dark/10 text-dark"
                      }`}
                    >
                      {l.title}
                    </span>
                  ))}
                  {items.length > MAX_PREVIEW && (
                    <span className="text-coral px-1.5 text-[10px] font-medium">
                      +{items.length - MAX_PREVIEW} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="border-border mt-4 overflow-hidden rounded-xl border bg-white">
          <div className="border-border flex items-center justify-between border-b px-5 py-3.5">
            <h3 className="text-dark text-[15px] font-semibold">
              {FULL_WEEKDAYS[selectedDate.getDay()]}, {MONTHS[selectedDate.getMonth()]}{" "}
              {selectedDate.getDate()}, {selectedDate.getFullYear()}
            </h3>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close day"
              className="hover:bg-tag-bg text-gray flex h-7 w-7 items-center justify-center rounded-full"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-gray px-5 py-8 text-center text-[13px]">No events on this day.</p>
          ) : (
            <ul className="divide-border divide-y">
              {selectedItems.map((l) => {
                const meta = [l.timeDisplay, l.venueName, l.neighborhood].filter(Boolean).join(" · ");
                return (
                  <li key={l.id}>
                    <Link
                      href={detailHref(l)}
                      className="hover:bg-tag-bg flex items-center justify-between gap-4 px-5 py-3.5"
                    >
                      <div className="min-w-0">
                        <h4 className="text-dark truncate text-[14px] font-medium">{l.title}</h4>
                        {meta && <p className="text-gray mt-0.5 truncate text-[12px]">{meta}</p>}
                      </div>
                      {l.isFree && <FreePill />}
                    </Link>
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
