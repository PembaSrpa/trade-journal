"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

type Level = "years" | "months" | "days";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const LEVELS: Level[] = ["years", "months", "days"];

interface DateZoomPickerProps {
  onSelect: (range: { from: string; to: string; label: string }) => void;
}

export function DateZoomPicker({ onSelect }: DateZoomPickerProps) {
  const now = new Date();
  const [level, setLevel] = useState<Level>("days");
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [yearBlockStart, setYearBlockStart] = useState(now.getFullYear() - (now.getFullYear() % 12));

  const lastGestureRef = useRef(0);
  const pinchStartDistRef = useRef<number | null>(null);
  const GESTURE_COOLDOWN = 350;

  function zoomOut() {
    const idx = LEVELS.indexOf(level);
    if (idx > 0) {
      const next = LEVELS[idx - 1];
      if (next === "years") setYearBlockStart(viewYear - (viewYear % 12));
      setLevel(next);
    }
  }

  function zoomIn() {
    const idx = LEVELS.indexOf(level);
    if (idx < LEVELS.length - 1) setLevel(LEVELS[idx + 1]);
  }

  function handleWheel(e: React.WheelEvent) {
    const now = Date.now();
    if (now - lastGestureRef.current < GESTURE_COOLDOWN) return;
    lastGestureRef.current = now;
    if (e.deltaY > 0) zoomOut();
    else zoomIn();
  }

  function touchDistance(touches: React.TouchList): number {
    const [a, b] = [touches[0], touches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      pinchStartDistRef.current = touchDistance(e.touches);
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length !== 2 || pinchStartDistRef.current === null) return;
    const dist = touchDistance(e.touches);
    const delta = dist - pinchStartDistRef.current;
    const now = Date.now();
    if (Math.abs(delta) > 40 && now - lastGestureRef.current > GESTURE_COOLDOWN) {
      lastGestureRef.current = now;
      if (delta > 0) zoomIn();
      else zoomOut();
      pinchStartDistRef.current = dist;
    }
  }

  function handleTouchEnd() {
    pinchStartDistRef.current = null;
  }

  function shift(delta: number) {
    if (level === "days") {
      let m = viewMonth + delta;
      let y = viewYear;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      setViewMonth(m);
      setViewYear(y);
    } else if (level === "months") {
      setViewYear(viewYear + delta);
    } else {
      setYearBlockStart(yearBlockStart + delta * 12);
    }
  }

  function selectYear(year: number) {
    const from = new Date(year, 0, 1).toISOString();
    const to = new Date(year, 11, 31, 23, 59, 59).toISOString();
    onSelect({ from, to, label: String(year) });
  }

  function selectMonth(year: number, month: number) {
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    onSelect({ from, to, label: `${MONTH_NAMES[month]} ${year}` });
  }

  function selectDay(year: number, month: number, day: number) {
    const from = new Date(year, month, day).toISOString();
    const to = new Date(year, month, day, 23, 59, 59).toISOString();
    onSelect({ from, to, label: `${MONTH_ABBR[month]} ${day}, ${year}` });
  }

  const headerLabel =
    level === "days"
      ? `${MONTH_NAMES[viewMonth]} ${viewYear}`
      : level === "months"
      ? String(viewYear)
      : `${yearBlockStart} - ${yearBlockStart + 11}`;

  return (
    <div
      className="bg-surface border border-border rounded-2xl p-4 max-w-sm select-none"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between mb-3">
        <button onClick={zoomOut} disabled={level === "years"} className="w-8 h-8 p-0 flex items-center justify-center" aria-label="Zoom out">
          <ZoomOut size={15} />
        </button>
        <span className="text-sm font-medium">{headerLabel}</span>
        <button onClick={zoomIn} disabled={level === "days"} className="w-8 h-8 p-0 flex items-center justify-center" aria-label="Zoom in">
          <ZoomIn size={15} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => shift(-1)} className="w-8 h-8 p-0 flex-shrink-0 flex items-center justify-center" aria-label="Previous">
          <ChevronLeft size={15} />
        </button>

        <div className="flex-1">
          {level === "days" && <DaysGrid year={viewYear} month={viewMonth} onSelect={selectDay} />}
          {level === "months" && <MonthsGrid year={viewYear} onSelect={selectMonth} />}
          {level === "years" && <YearsGrid start={yearBlockStart} onSelect={selectYear} />}
        </div>

        <button onClick={() => shift(1)} className="w-8 h-8 p-0 flex-shrink-0 flex items-center justify-center" aria-label="Next">
          <ChevronRight size={15} />
        </button>
      </div>

      <p className="text-xs text-text-muted text-center mt-3">
        Scroll to zoom on desktop, pinch on mobile. Tap a year or month to filter directly.
      </p>
    </div>
  );
}

function DaysGrid({
  year,
  month,
  onSelect,
}: {
  year: number;
  month: number;
  onSelect: (y: number, m: number, d: number) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="grid grid-cols-7 gap-1">
      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
        <span key={i} className="text-xs text-text-muted text-center">
          {d}
        </span>
      ))}
      {cells.map((day, i) =>
        day === null ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            onClick={() => onSelect(year, month, day)}
            className="aspect-square min-h-9 p-0 text-xs"
          >
            {day}
          </button>
        )
      )}
    </div>
  );
}

function MonthsGrid({ year, onSelect }: { year: number; onSelect: (y: number, m: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MONTH_ABBR.map((m, i) => (
        <button key={i} onClick={() => onSelect(year, i)} className="min-h-11 text-xs">
          {m}
        </button>
      ))}
    </div>
  );
}

function YearsGrid({ start, onSelect }: { start: number; onSelect: (y: number) => void }) {
  const years = Array.from({ length: 12 }, (_, i) => start + i);
  return (
    <div className="grid grid-cols-3 gap-2">
      {years.map((y) => (
        <button key={y} onClick={() => onSelect(y)} className="min-h-11 text-xs">
          {y}
        </button>
      ))}
    </div>
  );
}
