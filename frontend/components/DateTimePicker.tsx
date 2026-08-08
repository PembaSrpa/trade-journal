"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from "lucide-react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const parsed = parseValue(value);

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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
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
  }, []);

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

      {open && (
        <div className="absolute z-30 mt-2 bg-surface border border-border rounded-2xl p-4 w-[19rem] max-w-[calc(100vw-2rem)] shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="w-7 h-7 !p-0 flex items-center justify-center"
              aria-label="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <button type="button" onClick={goToToday} className="!bg-transparent !border-none text-sm font-medium hover:text-accent-glow">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="w-7 h-7 !p-0 flex items-center justify-center"
              aria-label="Next month"
            >
              <ChevronRight size={14} />
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
              <select
                value={hh}
                onChange={(e) => updateTime(Number(e.target.value), mm)}
                className="!w-auto !py-1.5 !px-2 !text-sm flex-1"
                aria-label="Hour"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{pad(h)}</option>
                ))}
              </select>
              <span className="text-text-muted">:</span>
              <select
                value={mm}
                onChange={(e) => updateTime(hh, Number(e.target.value))}
                className="!w-auto !py-1.5 !px-2 !text-sm flex-1"
                aria-label="Minute"
              >
                {Array.from({ length: 60 }, (_, m) => m).map((m) => (
                  <option key={m} value={m}>{pad(m)}</option>
                ))}
              </select>
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
        </div>
      )}
    </div>
  );
}
