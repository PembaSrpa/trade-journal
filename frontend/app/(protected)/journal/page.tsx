"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileText, Plus } from "lucide-react";
import { apiDownload, apiGet } from "@/lib/api";
import { useAccountContext } from "@/lib/AccountContext";
import { isCombinedSelection } from "@/lib/accountSelection";
import { DateZoomPicker } from "@/components/DateZoomPicker";
import { emotionMeta } from "@/lib/emotions";
import type { Trade } from "@/lib/types";

type Preset = "today" | "week" | "month" | "custom";

function presetRange(preset: Preset): { from?: string; to?: string } {
  const now = new Date();
  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: start.toISOString() };
  }
  if (preset === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString() };
  }
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString() };
  }
  return {};
}

export default function JournalPage() {
  const { selectedAccountId, syncNonce } = useAccountContext();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [preset, setPreset] = useState<Preset>("today");
  const [customRange, setCustomRange] = useState<{ from: string; to: string; label: string } | null>(null);
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedAccountId || isCombinedSelection(selectedAccountId)) return;
    if (preset === "custom" && !customRange) return;

    setLoading(true);
    const range = preset === "custom" ? customRange! : presetRange(preset);
    const params = new URLSearchParams({
      account_id: selectedAccountId,
      sort,
      page: String(page),
      page_size: "10",
    });
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);

    apiGet<Trade[]>(`/trades?${params.toString()}`)
      .then(setTrades)
      .finally(() => setLoading(false));
  }, [selectedAccountId, preset, customRange, sort, page, syncNonce]);

  if (!selectedAccountId) {
    return <p className="text-text-secondary text-sm">Select or create an account first.</p>;
  }

  if (isCombinedSelection(selectedAccountId)) {
    return (
      <p className="text-text-secondary text-sm">
        Journal entries are tied to one account. Switch to a specific account to view or add
        trades — combined views are for Overview stats only.
      </p>
    );
  }

  async function handleExport(format: "csv" | "pdf") {
    if (!selectedAccountId) return;
    await apiDownload(
      `/export?account_id=${selectedAccountId}&format=${format}`,
      `trades.${format}`
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xl font-medium tracking-tight">Journal</p>
          <p className="text-xs text-text-muted mt-0.5">Every trade, logged and reviewed</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport("csv")} className="text-xs flex items-center gap-1.5">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => handleExport("pdf")} className="text-xs flex items-center gap-1.5">
            <FileText size={13} /> PDF
          </button>
          <Link href="/journal/new">
            <button className="bg-accent border-accent hover:bg-accent-glow text-white text-xs flex items-center gap-1.5">
              <Plus size={14} /> New
            </button>
          </Link>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {(["today", "week", "month", "custom"] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              setPreset(p);
              setPage(1);
            }}
            className={
              preset === p
                ? "border-accent text-accent-glow bg-accent-dim text-xs"
                : "text-xs"
            }
          >
            {p === "today" ? "Today" : p === "week" ? "This week" : p === "month" ? "This month" : "Custom"}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="mb-4">
          <DateZoomPicker
            onSelect={(range) => {
              setCustomRange(range);
              setPage(1);
            }}
          />
          {customRange && (
            <p className="text-xs text-text-muted mt-2">Showing: {customRange.label}</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <select value={sort} onChange={(e) => setSort(e.target.value as "desc" | "asc")} className="w-auto text-sm">
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : trades.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center">
          <p className="text-text-secondary text-sm mb-1">
            {preset === "custom" && !customRange ? "Pick a year, month, or day above." : "No trades in this range."}
          </p>
          {preset === "today" && (
            <p className="text-text-muted text-xs">Nothing logged today yet — that&apos;s fine, log it when you close a trade.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 mb-6">
          {trades.map((trade) => (
            <Link key={trade.id} href={`/journal/${trade.id}`}>
              <div className="bg-surface border border-border rounded-2xl p-4 hover:border-accent/50 hover:bg-surface-2 transition-colors h-full">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-medium truncate">
                      {trade.pair} <span className="text-text-muted font-normal">· {trade.direction === "long" ? "Long" : "Short"}</span>
                    </p>
                    {trade.is_revenge_trade && (
                      <span className="text-xs bg-danger/15 text-danger border border-danger/30 rounded-full px-2 py-0.5 flex-shrink-0">⚠ Revenge</span>
                    )}
                  </div>
                  {trade.pips !== null && (
                    <p className={`flex-shrink-0 ml-2 ${trade.pips >= 0 ? "text-success font-medium" : "text-danger font-medium"}`}>
                      {trade.pips >= 0 ? "+" : ""}{trade.pips} pips
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 mb-2">
                  <p className="text-xs text-text-muted">
                    {new Date(trade.entry_time).toLocaleDateString()} · {trade.session ?? "-"} ·{" "}
                    {trade.status === "open" ? "Open" : trade.exit_type ?? "Closed"}
                  </p>
                  {trade.emotional_state && (
                    <span className="text-xs text-text-secondary">
                      {emotionMeta(trade.emotional_state).emoji} {emotionMeta(trade.emotional_state).label}
                    </span>
                  )}
                  {trade.confidence_score !== null && trade.confidence_score !== undefined && (
                    <span className="text-xs text-text-muted">{"★".repeat(trade.confidence_score)}{"☆".repeat(5 - trade.confidence_score)}</span>
                  )}
                </div>
                {trade.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {trade.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-bg border border-border rounded-full px-2 py-0.5 text-text-secondary">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-sm">
          Previous
        </button>
        <button disabled={trades.length < 10} onClick={() => setPage((p) => p + 1)} className="text-sm">
          Next
        </button>
      </div>
    </div>
  );
}
