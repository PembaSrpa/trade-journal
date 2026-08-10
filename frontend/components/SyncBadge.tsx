"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, WifiOff } from "lucide-react";
import type { SyncStatus } from "@/lib/useCachedFetch";

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SyncBadge({
  status,
  cachedAt,
  className,
}: {
  status: SyncStatus;
  cachedAt: string | null;
  className?: string;
}) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  if (status === "initial") return null;

  if (status === "revalidating") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-text-muted ${className ?? ""}`}>
        <RefreshCw size={11} className="animate-spin" />
        Updating
      </span>
    );
  }

  if (status === "error" && !cachedAt) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-danger ${className ?? ""}`}>
        <WifiOff size={11} />
        Couldn&apos;t load
      </span>
    );
  }

  if (!cachedAt) return null;

  if (status === "error") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-warning ${className ?? ""}`}>
        <WifiOff size={11} />
        Offline, showing {relativeTime(cachedAt)}
      </span>
    );
  }

  const seconds = Math.floor((Date.now() - new Date(cachedAt).getTime()) / 1000);
  if (seconds < 15) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-success ${className ?? ""}`}>
        <CheckCircle2 size={11} />
        Live
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-text-muted ${className ?? ""}`}>
      Synced {relativeTime(cachedAt)}
    </span>
  );
}
