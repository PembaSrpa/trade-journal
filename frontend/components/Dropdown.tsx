"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { usePopoverPlacement } from "@/lib/usePopoverPlacement";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  disabled?: boolean;
}

export function Dropdown<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  className,
  buttonClassName,
  align = "left",
  disabled,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { placement, maxHeight } = usePopoverPlacement(open, ref, 256);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className ?? ""}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 !text-left !font-normal ${buttonClassName ?? ""}`}
      >
        <span className={`truncate ${selected ? "" : "text-text-muted"}`}>
          {selected ? selected.label : placeholder ?? "Select"}
        </span>
        <ChevronDown size={14} className="text-text-muted flex-shrink-0" />
      </button>

      {open && (
        <div
          className={`absolute z-30 ${placement === "top" ? "bottom-full mb-2" : "top-full mt-2"} ${
            align === "right" ? "right-0" : "left-0"
          } bg-surface border border-border rounded-2xl p-1.5 min-w-full w-max max-w-[calc(100vw-2.5rem)] overflow-y-auto shadow-xl`}
          style={{ maxHeight }}
        >
          {options.length === 0 && (
            <p className="text-xs text-text-muted px-2.5 py-2">No options</p>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left text-sm !bg-transparent !border-none px-2.5 py-2 rounded-lg hover:bg-white/5 flex items-center justify-between gap-3 ${
                opt.value === value ? "text-accent-glow" : "text-text"
              }`}
            >
              <span className="truncate">{opt.label}</span>
              {opt.value === value && <Check size={13} className="flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
