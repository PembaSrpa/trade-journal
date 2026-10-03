import { AlertTriangle } from "lucide-react";

/** Shown when a trade's quote currency differs from the account currency and no conversion rate was entered. */
export function UnconvertedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="This pair isn't quoted in your account currency and no conversion rate was entered, so the P/L is in the pair's quote currency. Edit the trade and add a conversion rate."
      className={`inline-flex items-center gap-1 text-[10px] text-amber-400 border border-amber-400/40 rounded px-1 py-0.5 ${className}`}
    >
      <AlertTriangle size={10} /> unconverted
    </span>
  );
}
