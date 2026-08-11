"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, AlertTriangle, Brain } from "lucide-react";
import { apiDelete, apiGet } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import { getSignedScreenshotUrl } from "@/lib/screenshots";
import { useAccountContext } from "@/lib/AccountContext";
import { readCache, writeCache, clearCacheByPrefix } from "@/lib/dataCache";
import { TradeDetailSkeleton } from "@/components/skeletons/TradeDetailSkeleton";
import { emotionMeta } from "@/lib/emotions";
import type { Trade } from "@/lib/types";
import { PRICE_MOVE_LABEL } from "@/lib/instruments";

export default function TradeDetailPage() {
  return (
    <Suspense fallback={<TradeDetailSkeleton />}>
      <TradeDetailInner />
    </Suspense>
  );
}

function TradeDetailInner() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const confirmDialog = useConfirm();
  const { triggerSync } = useAccountContext();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const cacheKey = `trade:${id}`;

    readCache<Trade>(cacheKey).then((cached) => {
      if (cached && !cancelled) {
        setTrade(cached.data);
        setLoading(false);
        if (cached.data.screenshot_url) {
          getSignedScreenshotUrl(cached.data.screenshot_url).then((url) => {
            if (!cancelled) setScreenshotUrl(url);
          });
        }
      }
    });

    apiGet<Trade>(`/trades/${id}`)
      .then((data) => {
        if (cancelled) return;
        setTrade(data);
        void writeCache(cacheKey, data);
        if (data.screenshot_url) {
          getSignedScreenshotUrl(data.screenshot_url).then((url) => {
            if (!cancelled) setScreenshotUrl(url);
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    if (!id) return;
    const ok = await confirmDialog({
      title: "Delete this trade?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await apiDelete(`/trades/${id}`);
    await clearCacheByPrefix("trades:");
    await clearCacheByPrefix("stats:");
    triggerSync();
    router.push("/journal");
  }

  if (loading && !trade) return <TradeDetailSkeleton />;
  if (!trade) return <p className="text-text-secondary text-sm">Trade not found.</p>;

  const emotion = trade.emotional_state ? emotionMeta(trade.emotional_state) : null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/journal">
          <button className="w-9 h-9 p-0 flex items-center justify-center"><ArrowLeft size={16} /></button>
        </Link>
        <p className="text-xl font-medium tracking-tight">Trade detail</p>
        <div className="ml-auto flex gap-2">
          <Link href={`/journal/trade/edit?id=${trade.id}`}>
            <button className="flex items-center gap-1.5 text-sm"><Pencil size={13} /> Edit</button>
          </Link>
          <button onClick={handleDelete} className="flex items-center gap-1.5 text-sm text-danger hover:border-danger/50">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      {trade.is_revenge_trade && (
        <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/30 rounded-2xl px-4 py-3 mb-6 text-danger text-sm">
          <AlertTriangle size={15} />
          This trade was flagged as a potential revenge trade — it was opened within 30 minutes of a losing trade.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Column 1: Core trade data */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="text-2xl font-medium tracking-tight">{trade.pair}</p>
                <p className={`text-sm font-medium ${trade.direction === "long" ? "text-success" : "text-danger"}`}>
                  {trade.direction === "long" ? "↗ Long" : "↘ Short"}
                </p>
              </div>
              {trade.pnl !== null && (
                <div className="text-right">
                  <p className={`text-xl font-medium ${trade.pnl >= 0 ? "text-success" : "text-danger"}`}>
                    {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toLocaleString()}
                  </p>
                  {trade.pips !== null && (
                    <p className={`text-sm ${trade.pips >= 0 ? "text-success" : "text-danger"}`}>
                      {trade.pips >= 0 ? "+" : ""}{trade.pips} {PRICE_MOVE_LABEL[trade.asset_class]}
                    </p>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-text-muted mt-2">
              {new Date(trade.entry_time).toLocaleString()}
              {trade.session && ` · ${trade.session.charAt(0).toUpperCase() + trade.session.slice(1)}`}
              {trade.hold_minutes !== null && ` · held ${formatMinutes(trade.hold_minutes)}`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Entry price" value={trade.entry_price.toString()} />
            <Field label="Exit price" value={trade.exit_price?.toString() ?? "—"} />
            <Field label="Initial SL" value={trade.initial_sl?.toString() ?? "—"} />
            <Field label="TP" value={trade.tp?.toString() ?? "—"} />
            <Field label="Lot size" value={`${trade.lot_size} ${trade.lot_unit}`} />
            <Field label="R multiple" value={trade.r_multiple !== null ? `${trade.r_multiple >= 0 ? "+" : ""}${trade.r_multiple}R` : "—"} />
            <Field label="Exit type" value={trade.exit_type?.replace("_", " ") ?? "—"} />
            {trade.rule_adherence_percent !== null && (
              <Field label="Rules followed" value={`${trade.rule_adherence_percent}%`} />
            )}
          </div>

          {trade.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {trade.tags.map((tag) => (
                <span key={tag} className="text-xs bg-surface border border-border rounded-full px-2.5 py-1 text-text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Psychology + Reflection */}
        <div className="xl:col-span-1 space-y-4">
          {(emotion || trade.confidence_score !== null) && (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <p className="text-xs text-text-secondary mb-3">Psychology at entry</p>
              {emotion && (
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                      emotion.tone === "good"
                        ? "bg-success/15 text-success"
                        : emotion.tone === "bad"
                        ? "bg-danger/15 text-danger"
                        : "bg-surface-2 text-text-secondary"
                    }`}
                  >
                    <Brain size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{emotion.label}</p>
                    <p className="text-xs text-text-muted">Emotional state</p>
                  </div>
                </div>
              )}
              {trade.confidence_score !== null && (
                <div>
                  <p className="text-xs text-text-secondary mb-1">Confidence</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div
                        key={n}
                        className={`w-8 h-2 rounded-full ${
                          n <= (trade.confidence_score ?? 0) ? "bg-accent" : "bg-surface-2 border border-border"
                        }`}
                      />
                    ))}
                    <span className="text-xs text-text-muted ml-2">{trade.confidence_score}/5</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {trade.reasoning && (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <p className="text-xs text-text-secondary mb-2">Why I took this trade</p>
              <p className="text-sm leading-relaxed">{trade.reasoning}</p>
            </div>
          )}

          {trade.lesson && (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <p className="text-xs text-text-secondary mb-2">What I learned</p>
              <p className="text-sm leading-relaxed">{trade.lesson}</p>
            </div>
          )}
        </div>

        {/* Column 3: Screenshot */}
        <div className="xl:col-span-1">
          {screenshotUrl ? (
            <img
              src={screenshotUrl}
              alt="Trade chart screenshot"
              className="w-full rounded-2xl border border-border xl:sticky xl:top-6"
            />
          ) : (
            <div className="bg-surface border border-dashed border-border rounded-2xl p-10 text-center xl:sticky xl:top-6">
              <p className="text-text-muted text-sm">No screenshot attached</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-3">
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
