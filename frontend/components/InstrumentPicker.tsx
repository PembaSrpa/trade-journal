"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { type AssetClass, ASSET_CLASS_LABEL, INSTRUMENT_GROUPS, guessAssetClass } from "@/lib/instruments";

interface InstrumentPickerProps {
  symbol: string;
  assetClass: AssetClass;
  onChange: (symbol: string, assetClass: AssetClass) => void;
}

export function InstrumentPicker({ symbol, assetClass, onChange }: InstrumentPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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

  const q = query.trim().toUpperCase();
  const allInstruments = INSTRUMENT_GROUPS.flatMap((g) => g.instruments);
  const filteredGroups = INSTRUMENT_GROUPS.map((g) => ({
    ...g,
    instruments: q
      ? g.instruments.filter((i) => i.symbol.toUpperCase().includes(q) || i.label.toUpperCase().includes(q))
      : g.instruments,
  })).filter((g) => g.instruments.length > 0);

  function select(sym: string, ac: AssetClass) {
    onChange(sym, ac);
    setQuery("");
    setOpen(false);
  }

  function applyCustomSymbol() {
    const sym = query.trim().toUpperCase();
    if (!sym) return;
    onChange(sym, guessAssetClass(sym));
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="!bg-transparent !border-none !p-0 flex flex-col items-start text-left"
      >
        <span className="flex items-center gap-1.5">
          <span className="!text-2xl !font-medium tracking-tight">{symbol}</span>
          <ChevronDown size={16} className="text-text-muted flex-shrink-0" />
        </span>
        <span className="text-[10px] uppercase tracking-wide text-text-muted">
          {ASSET_CLASS_LABEL[assetClass]}
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 left-0 bg-surface border border-border rounded-2xl p-3 w-[17rem] max-w-[calc(100vw-2.5rem)] max-h-[22rem] overflow-y-auto shadow-xl">
          <div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2 mb-3 sticky top-0">
            <Search size={13} className="text-text-muted flex-shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const exact = allInstruments.find((i) => i.symbol.toUpperCase() === q);
                  if (exact) select(exact.symbol, exact.assetClass);
                  else applyCustomSymbol();
                }
              }}
              placeholder="Search or type any symbol"
              className="!bg-transparent !border-none !p-0 !text-sm w-full"
            />
          </div>

          {filteredGroups.length === 0 && query.trim() && (
            <button
              type="button"
              onClick={applyCustomSymbol}
              className="w-full text-left text-sm text-accent-glow !bg-transparent !border-none px-1 py-1.5"
            >
              Use &quot;{q}&quot;
            </button>
          )}

          {filteredGroups.map((g) => (
            <div key={g.assetClass} className="mb-2 last:mb-0">
              <p className="text-[10px] uppercase tracking-wide text-text-muted px-1 mb-1">{g.label}</p>
              {g.instruments.map((i) => (
                <button
                  key={i.symbol}
                  type="button"
                  onClick={() => select(i.symbol, i.assetClass)}
                  className={`w-full text-left text-sm !bg-transparent !border-none px-2 py-1.5 rounded-lg hover:bg-white/5 ${
                    i.symbol === symbol ? "text-accent-glow" : "text-text"
                  }`}
                >
                  {i.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
