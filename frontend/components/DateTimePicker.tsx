"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dropdown } from "@/components/Dropdown";
import { usePopoverPlacement } from "@/lib/usePopoverPlacement";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

interface Parsed {
  y: number;
  m: number; // 0-indexed
  d: number;
  hh: number;
  mm: number;
}

function parseValue(value: string): Parsed | null {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  const [hh, mm] = timePart ? timePart.split(":").map(Number) : [9, 0];
  return { y, m: m - 1, d, hh: hh ?? 9, mm: mm ?? 0 };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(p: Parsed): string {
  return `${MONTH_ABBR[p.m]} ${p.d}, ${p.y}`;
}

function formatTime(hh: number, mm: number): string {
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${pad(mm)} ${period}`;
}

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  mode?: "date" | "datetime";
  required?: boolean;
  placeholder?: string;
}

export function DateTimePicker({ value, onChange, mode = "datetime", required, placeholder }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const parsed = parseValue(value);
  const { placement, maxHeight } = usePopoverPlacement(open && !isMobile, containerRef, 420);

  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? today.getMonth());
  const [hh, setHh] = useState(parsed?.hh ?? 9);
  const [mm, setMm] = useState(parsed?.mm ?? 0);

  useEffect(() => {
    const p = parseValue(value);
    if (p) {
      setViewYear(p.y);
      setViewMonth(p.m);
      setHh(p.hh);
      setMm(p.mm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Below `sm` (640px) the picker renders as a bottom sheet instead of a
  // popover, since a fixed-width popover has nowhere good to open from on
  // a narrow screen and was overflowing past the viewport edge.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!open || !isMobile) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open, isMobile]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      // The mobile sheet is portaled to <body>, outside containerRef, and
      // closes via its own backdrop/buttons instead.
      if (isMobile) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobile]);

  function commit(y: number, m: number, d: number, hour: number, minute: number) {
    const dateStr = `${y}-${pad(m + 1)}-${pad(d)}`;
    onChange(mode === "datetime" ? `${dateStr}T${pad(hour)}:${pad(minute)}` : dateStr);
  }

  function selectDay(d: number) {
    commit(viewYear, viewMonth, d, hh, mm);
    if (mode === "date") setOpen(false);
  }

  function updateTime(newHh: number, newMm: number) {
    setHh(newHh);
    setMm(newMm);
    if (parsed) commit(parsed.y, parsed.m, parsed.d, newHh, newMm);
  }

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function goToToday() {
    commit(today.getFullYear(), today.getMonth(), today.getDate(), hh, mm);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isSelectedDay = (d: number) =>
    parsed !== null && parsed.y === viewYear && parsed.m === viewMonth && parsed.d === d;
  const isToday = (d: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate();

  const displayLabel = parsed
    ? mode === "datetime"
      ? `${formatDate(parsed)} \u00b7 ${formatTime(parsed.hh, parsed.mm)}`
      : formatDate(parsed)
    : placeholder ?? (mode === "datetime" ? "Select date & time" : "Select date");

  const calendarBody = (
    <>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="w-8 h-8 !p-0 flex items-center justify-center"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={goToToday} className="!bg-transparent !border-none text-sm font-medium hover:text-accent-glow">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </button>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="w-8 h-8 !p-0 flex items-center justify-center"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d, i) => (
          <span key={i} className="text-[10px] text-text-muted text-center">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) =>
          day === null ? (
            <div key={i} />
          ) : (
            <button
              type="button"
              key={i}
              onClick={() => selectDay(day)}
              className={`aspect-square !p-0 text-xs !rounded-lg ${
                isSelectedDay(day)
                  ? "!bg-accent !border-accent text-white"
                  : isToday(day)
                  ? "!bg-transparent !border-accent/50 text-accent-glow"
                  : "!bg-transparent"
              }`}
            >
              {day}
            </button>
          )
        )}
      </div>

      {mode === "datetime" && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <Clock size={13} className="text-text-muted flex-shrink-0" />
          <Dropdown
            value={String(hh)}
            onChange={(v) => updateTime(Number(v), mm)}
            options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: pad(h) }))}
            buttonClassName="!py-1.5 !px-2 !text-sm"
            className="flex-1"
          />
          <span className="text-text-muted">:</span>
          <Dropdown
            value={String(mm)}
            onChange={(v) => updateTime(hh, Number(v))}
            options={Array.from({ length: 60 }, (_, m) => m).map((m) => ({ value: String(m), label: pad(m) }))}
            buttonClassName="!py-1.5 !px-2 !text-sm"
            className="flex-1"
          />
          <span className="text-xs text-text-muted flex-shrink-0">{hh >= 12 ? "PM" : "AM"}</span>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        {parsed && !required && (
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className="!bg-transparent !border-border flex-1 text-sm flex items-center justify-center gap-1.5 text-text-secondary"
          >
            <X size={13} /> Clear
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="bg-accent border-accent hover:bg-accent-glow text-white flex-1 text-sm"
        >
          Done
        </button>
      </div>
    </>
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`!bg-[#1f1f1f] !border-[#404040] w-full flex items-center justify-between !text-left !font-normal !px-[13px] !py-[11px] !text-[15px] ${
          parsed ? "" : "text-text-muted"
        }`}
      >
        <span className="truncate">{displayLabel}</span>
        <Calendar size={14} className="text-text-muted flex-shrink-0 ml-2" />
      </button>
      {required && !parsed && <input tabIndex={-1} required className="sr-only" value="" onChange={() => {}} />}

      {open && !isMobile && (
        <div
          className={`absolute z-30 ${
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          } bg-surface border border-border rounded-2xl p-4 w-[19rem] max-w-[calc(100vw-2rem)] overflow-y-auto shadow-xl`}
          style={{ maxHeight }}
        >
          {calendarBody}
        </div>
      )}

      {open &&
        isMobile &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div
              ref={sheetRef}
              className="fixed inset-x-0 bottom-0 z-50 bg-surface border-t border-border rounded-t-3xl p-4"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))", maxHeight: "85vh", overflowY: "auto" }}
            >
              <div className="w-10 h-1 rounded-full bg-border-strong mx-auto mb-4" />
              {calendarBody}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
