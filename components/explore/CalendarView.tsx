"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Listing } from "@/lib/types";
import { TIME_BUCKETS, groupByTimeBucket, type TimeBucket } from "@/lib/calendar/timeBuckets";

interface Props {
  listings: Listing[];
}

type ViewMode = "month" | "week" | "day";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const FULL_WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const MAX_PREVIEW = 3;

// Local start-of-today, for clamping past/ongoing events.
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

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

function dateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

function addDaysKey(key: string, n: number): string {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay()); // Sunday-start week
  return s;
}

function sortByStart(items: Listing[]): Listing[] {
  return [...items].sort(
    (a, b) => (Date.parse(a.startAt || "") || 0) - (Date.parse(b.startAt || "") || 0),
  );
}

function FreePill() {
  return (
    <span className="bg-coral rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
      Free
    </span>
  );
}

// A single event row in the day/week lists.
function EventRow({ l }: { l: Listing }) {
  const meta = [l.timeDisplay, l.venueName, l.neighborhood].filter(Boolean).join(" · ");
  return (
    <Link
      href={detailHref(l)}
      className="hover:bg-tag-bg flex items-center justify-between gap-4 rounded-lg px-3 py-2.5"
    >
      <div className="min-w-0">
        <h4 className="text-dark truncate text-[13px] font-medium">{l.title}</h4>
        {meta && <p className="text-gray mt-0.5 truncate text-[11px]">{meta}</p>}
      </div>
      {l.isFree && <FreePill />}
    </Link>
  );
}

// A day's events as time-of-day tabs (Morning / Afternoon / Evening / All day) —
// click a tab to see just that section instead of scrolling one long list. Only
// non-empty buckets get a tab; the soonest one is selected first. Mount with a
// `key` per day so the selection resets when the day changes.
function DayAgenda({ items }: { items: Listing[] }) {
  const groups = groupByTimeBucket(items);
  const buckets = TIME_BUCKETS.filter((b) => groups[b.id].length > 0);
  const [active, setActive] = useState<TimeBucket>(buckets[0]?.id ?? "morning");
  if (buckets.length === 0) {
    return <p className="text-gray py-10 text-center text-[13px]">No events on this day.</p>;
  }
  const current = buckets.some((b) => b.id === active) ? active : buckets[0].id;
  return (
    <div className="flex flex-col gap-3">
      <div className="border-border flex flex-wrap gap-0.5 rounded-pill border p-0.5">
        {buckets.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setActive(b.id)}
            className={`rounded-pill px-3 py-1 text-[12px] font-medium transition-colors ${
              current === b.id ? "bg-dark text-white" : "text-graphite hover:text-dark"
            }`}
          >
            {b.label}
            <span className={`ml-1.5 ${current === b.id ? "text-white/70" : "text-gray"}`}>
              {groups[b.id].length}
            </span>
          </button>
        ))}
      </div>
      <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
        {groups[current].map((l) => (
          <EventRow key={l.id} l={l} />
        ))}
      </div>
    </div>
  );
}

export function CalendarView({ listings }: Props) {
  // Soonest day with a visible event — drives the initial month + selection.
  // Events ending before today are skipped (past); an ongoing event that started
  // earlier counts from today (so it opens the calendar on the current month,
  // not its past start month).
  const soonestKey = useMemo(() => {
    const todayMs = startOfToday().getTime();
    let min = Infinity;
    for (const l of listings) {
      const startT = l.startAt ? Date.parse(l.startAt) : NaN;
      if (Number.isNaN(startT)) continue;
      const parsedEnd = l.endAt ? Date.parse(l.endAt) : NaN;
      const endT = Number.isNaN(parsedEnd) ? startT : parsedEnd;
      if (endT < todayMs) continue; // entirely past
      const relevant = startT < todayMs ? todayMs : startT; // ongoing → from today
      if (relevant < min) min = relevant;
    }
    return Number.isFinite(min) ? dayKey(new Date(min)) : null;
  }, [listings]);

  const initialMonth = useMemo(() => {
    const d = soonestKey ? dateFromKey(soonestKey) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [soonestKey]);

  const todayKey = dayKey(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [{ year, month }, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState<string | null>(soonestKey);

  // Anchor day for week/day views (selection, else soonest, else today).
  const anchor = selected ?? soonestKey ?? todayKey;

  // Map each day → its listings. A multi-day event appears on each day it spans,
  // but never in the past: an event ending before today is dropped, and an
  // ongoing event that started earlier counts from today through its end date
  // (e.g. an Apr 17 → Jun 20 run shows from today, Jun 11, through Jun 20).
  const byDay = useMemo(() => {
    const map = new Map<string, Listing[]>();
    const push = (key: string, l: Listing) => {
      const arr = map.get(key);
      if (arr) arr.push(l);
      else map.set(key, [l]);
    };
    const today = startOfToday();
    for (const l of listings) {
      if (!l.startAt) continue;
      const start = new Date(l.startAt);
      if (Number.isNaN(start.getTime())) continue;
      const endMs = l.endAt ? Date.parse(l.endAt) : NaN;
      const end = Number.isNaN(endMs) ? start : new Date(endMs);
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      if (endDay < today) continue; // entirely past — don't show
      const cursor = new Date(startDay < today ? today : startDay); // clamp to today
      let guard = 0;
      while (cursor <= endDay && guard < 366) {
        push(dayKey(cursor), l);
        cursor.setDate(cursor.getDate() + 1);
        guard++;
      }
    }
    return map;
  }, [listings]);

  function changeMode(m: ViewMode) {
    if (m !== "month" && !selected) setSelected(soonestKey ?? todayKey);
    setViewMode(m);
  }

  function go(delta: number) {
    if (viewMode === "month") {
      const d = new Date(year, month + delta, 1);
      setMonth({ year: d.getFullYear(), month: d.getMonth() });
    } else {
      setSelected(addDaysKey(anchor, delta * (viewMode === "week" ? 7 : 1)));
    }
  }

  function goToday() {
    const now = new Date();
    setMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(todayKey);
  }

  // ── Header title per mode ────────────────────────────────────────────────
  let title: string;
  if (viewMode === "month") {
    title = `${MONTHS[month]} ${year}`;
  } else if (viewMode === "day") {
    const d = dateFromKey(anchor);
    title = `${FULL_WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } else {
    const s = startOfWeek(dateFromKey(anchor));
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    title =
      s.getMonth() === e.getMonth()
        ? `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`
        : `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }

  // ── Month grid cells ─────────────────────────────────────────────────────
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array<null>(firstOfMonth.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // ── Week days ────────────────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    const s = startOfWeek(dateFromKey(anchor));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(d.getDate() + i);
      return dayKey(d);
    });
  }, [anchor]);

  const dayItems = sortByStart(byDay.get(anchor) ?? []);

  return (
    <div>
      <div className="border-border overflow-hidden rounded-xl border bg-white">
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-dark text-[15px] font-semibold">{title}</h2>
          <div className="flex items-center gap-2">
            {/* Month / Week / Day toggle */}
            <div className="border-border flex rounded-pill border p-0.5">
              {(["month", "week", "day"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => changeMode(m)}
                  className={`rounded-pill px-3 py-1 text-[12px] font-medium capitalize transition-colors ${
                    viewMode === m ? "bg-dark text-white" : "text-graphite hover:text-dark"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => go(-1)} aria-label="Previous" className="hover:bg-tag-bg text-graphite flex h-8 w-8 items-center justify-center rounded-full">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button type="button" onClick={goToday} className="text-graphite hover:text-dark rounded-pill px-3 py-1 text-[12px] font-medium">
                Today
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Next" className="hover:bg-tag-bg text-graphite flex h-8 w-8 items-center justify-center rounded-full">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>
        </div>

        {viewMode === "month" && (
          <>
            <div className="border-border grid grid-cols-7 border-b">
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
                // Position the hover popover inward so the grid card's
                // overflow-hidden doesn't clip it on the bottom row / edge cols.
                const col = i % 7;
                const lastRow = Math.floor(i / 7) >= cells.length / 7 - 1;
                const popPos = `${lastRow ? "bottom-full mb-1" : "top-full mt-1"} ${
                  col === 0 ? "left-0" : col === 6 ? "right-0" : "left-1/2 -translate-x-1/2"
                }`;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelected(key)}
                    className={`group relative min-h-[108px] cursor-pointer border-b border-r border-border p-1.5 text-left align-top transition-colors hover:bg-[#fafafa] ${
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

                    {/* Hover-to-see-day: full list of the day's events on hover. */}
                    {items.length > 0 && (
                      <div className={`border-border pointer-events-none absolute z-30 hidden w-60 rounded-xl border bg-white p-2.5 text-left shadow-xl group-hover:block ${popPos}`}>
                        <p className="text-graphite mb-1.5 text-[11px] font-semibold">
                          {MONTHS[month]} {day} · {items.length} event{items.length > 1 ? "s" : ""}
                        </p>
                        <ul className="flex flex-col gap-1">
                          {sortByStart(items).map((l) => (
                            <li key={l.id} className="flex items-baseline gap-1.5">
                              <span className="text-gray shrink-0 text-[10px]">{l.timeDisplay || "—"}</span>
                              <span className="text-dark truncate text-[11px] font-medium">{l.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {viewMode === "week" && (
          <div className="grid grid-cols-7">
            {weekDays.map((key) => {
              const d = dateFromKey(key);
              const items = sortByStart(byDay.get(key) ?? []);
              const isToday = key === todayKey;
              return (
                <div key={key} className="border-border min-h-[280px] border-b border-r last:border-r-0">
                  <button
                    type="button"
                    onClick={() => { setSelected(key); changeMode("day"); }}
                    className="hover:bg-tag-bg flex w-full items-center justify-between border-b border-border px-2 py-2 text-left"
                  >
                    <span className="text-graphite text-[11px] font-semibold uppercase">{WEEKDAYS[d.getDay()]}</span>
                    <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[12px] ${isToday ? "bg-dark font-semibold text-white" : "text-graphite"}`}>
                      {d.getDate()}
                    </span>
                  </button>
                  <div className="flex flex-col gap-1 p-1.5">
                    {items.length === 0 ? (
                      <span className="text-gray px-1 py-2 text-[11px]">—</span>
                    ) : (
                      items.map((l) => (
                        <Link
                          key={l.id}
                          href={detailHref(l)}
                          className={`truncate rounded px-1.5 py-1 text-[11px] font-medium leading-tight ${
                            l.type === "deal" ? "bg-coral/15 text-coral" : "bg-dark/10 text-dark"
                          }`}
                        >
                          {l.timeDisplay ? `${l.timeDisplay} · ` : ""}{l.title}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === "day" && (
          <div className="p-4">
            <DayAgenda key={anchor} items={dayItems} />
          </div>
        )}
      </div>

      {/* Month view keeps the click-to-select day detail panel below the grid. */}
      {viewMode === "month" && selected && (
        <div className="border-border mt-4 overflow-hidden rounded-xl border bg-white">
          <div className="border-border flex items-center justify-between border-b px-5 py-3.5">
            <h3 className="text-dark text-[15px] font-semibold">
              {(() => {
                const d = dateFromKey(selected);
                return `${FULL_WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
              })()}
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
          <div className="p-4">
            <DayAgenda key={selected} items={dayItems} />
          </div>
        </div>
      )}
    </div>
  );
}
