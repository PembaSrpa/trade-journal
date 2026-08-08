"use client";

import { useState } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function PnlCalendar({ dailyPnl }: { dailyPnl: Record<string, number> }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function pnlFor(day: number): number | undefined {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return dailyPnl[key];
  }

  function colorFor(pnl: number | undefined): string {
    if (pnl === undefined) return "transparent";
    if (pnl > 0) return "rgba(47, 191, 113, 0.35)";
    if (pnl < 0) return "rgba(224, 85, 79, 0.35)";
    return "rgba(139, 147, 161, 0.15)";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => shift(-1)} className="w-8 h-8 p-0">
          {"<"}
        </button>
        <span className="text-sm font-medium">
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={() => shift(1)} className="w-8 h-8 p-0">
          {">"}
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-xs text-text-secondary text-center">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const pnl = pnlFor(day);
          return (
            <div
              key={i}
              className="aspect-square rounded flex items-center justify-center text-xs"
              style={{ backgroundColor: colorFor(pnl) }}
              title={pnl !== undefined ? `$${pnl.toFixed(2)}` : ""}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
