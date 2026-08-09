"use client";

import { useEffect, useRef } from "react";
import {
  TrendingUp, Target, Percent, Clock, TrendingDown, CircleDot,
  Flame, LineChart, CalendarDays, ListChecks, Newspaper, Brain,
  Activity, AlertTriangle, Wallet,
} from "lucide-react";
import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { apiGet } from "@/lib/api";
import { useAccountContext } from "@/lib/AccountContext";
import { combinedAccountType, isCombinedSelection } from "@/lib/accountSelection";
import { useCachedFetch } from "@/lib/useCachedFetch";
import { clearCache } from "@/lib/dataCache";
import { EquityCurve } from "@/components/EquityCurve";
import { NewsFeed } from "@/components/NewsFeed";
import { PnlCalendar } from "@/components/PnlCalendar";
import { SyncBadge } from "@/components/SyncBadge";
import { OverviewSkeleton } from "@/components/skeletons/OverviewSkeleton";
import { emotionMeta, emotionToneClass } from "@/lib/emotions";
import type { Stats } from "@/lib/types";

export default function OverviewPage() {
  const { selectedAccountId, accounts, loading: accountsLoading, syncNonce } = useAccountContext();

  const cacheKey = selectedAccountId ? `stats:${selectedAccountId}` : null;
  const previousSyncNonce = useRef(syncNonce);

  const { data: stats, status, cachedAt, refetch } = useCachedFetch<Stats>(
    cacheKey,
    async () => {
      const query = isCombinedSelection(selectedAccountId!)
        ? `account_type=${combinedAccountType(selectedAccountId!)}`
        : `account_id=${selectedAccountId}`;
      return apiGet<Stats>(`/stats?${query}`);
    },
    [selectedAccountId]
  );

  useEffect(() => {
    if (syncNonce === previousSyncNonce.current) return;
    previousSyncNonce.current = syncNonce;
    if (!cacheKey) return;
    clearCache(cacheKey).then(refetch);
  }, [syncNonce, cacheKey, refetch]);

  if (accountsLoading && !selectedAccountId) return <OverviewSkeleton />;

  if (!accountsLoading && accounts.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-10 text-center max-w-md mx-auto mt-12">
        <p className="text-text-secondary mb-3">No accounts yet.</p>
        <a href="/settings" className="text-accent-glow">Create your first account</a>
      </div>
    );
  }

  if (!selectedAccountId) return <OverviewSkeleton />;

  return (
    <div className="w-full">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-medium tracking-tight">Overview</p>
          <p className="text-xs text-text-muted mt-0.5">Your performance, at a glance</p>
        </div>
        <SyncBadge status={status} cachedAt={cachedAt} />
      </div>

      {!stats ? (
        <OverviewSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard icon={Percent} label="Win rate" value={`${stats.win_rate}%`} />
            <StatCard icon={TrendingUp} label="Net P/L"
              value={`${stats.net_pnl >= 0 ? "+" : ""}$${stats.net_pnl.toLocaleString()}`}
              tone={stats.net_pnl >= 0 ? "success" : "danger"} />
            <StatCard icon={Target} label="Avg R:R" value={stats.avg_r_multiple.toString()} />
            <StatCard icon={Clock} label="Avg hold" value={formatMinutes(stats.avg_hold_minutes)} />
            <StatCard icon={TrendingDown} label="Max drawdown" value={`-${stats.max_drawdown}%`} tone="danger" />
            <StatCard icon={CircleDot} label="Open trades" value={stats.open_trades.toString()} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6 items-start">
            <div className="xl:col-span-3">
              <SectionHeader icon={LineChart} title="Equity curve" />
              <div className="bg-surface border border-border rounded-2xl p-4 h-[26rem] flex flex-col">
                <div className="flex-1 min-h-0"><EquityCurve data={stats.equity_curve} /></div>
              </div>
            </div>
            <div className="xl:col-span-2">
              <SectionHeader icon={CalendarDays} title="Daily P/L" />
              <div className="bg-surface border border-border rounded-2xl p-4">
                <div className="w-full max-w-[420px] mx-auto">
                  <PnlCalendar dailyPnl={stats.daily_pnl} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard icon={Wallet} label="Current balance"
              value={`$${stats.current_balance.toLocaleString()}`} />
            <StatCard icon={TrendingUp} label="Expectancy"
              value={`${stats.expectancy >= 0 ? "+" : ""}$${stats.expectancy}`}
              tone={stats.expectancy >= 0 ? "success" : "danger"} />
            <StatCard icon={Target} label="Profit factor" value={stats.profit_factor.toString()} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-surface border border-border rounded-2xl p-5">
              <SectionHeader icon={Flame} title="Streaks" />
              <div className="grid grid-cols-3 gap-3 mt-1">
                <div>
                  <p className="text-xs text-text-secondary mb-1">Current</p>
                  <p className={`text-xl font-medium ${stats.current_streak > 0 ? "text-success" : stats.current_streak < 0 ? "text-danger" : ""}`}>
                    {stats.current_streak > 0 ? `${stats.current_streak}W` : stats.current_streak < 0 ? `${Math.abs(stats.current_streak)}L` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-1">Best run</p>
                  <p className="text-xl font-medium text-success">{stats.longest_win_streak}W</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-1">Worst run</p>
                  <p className="text-xl font-medium text-danger">{stats.longest_loss_streak}L</p>
                </div>
              </div>
            </div>

            <StatCard icon={TrendingUp} label="Avg win" value={`+$${stats.avg_win}`} tone="success" />
            <StatCard icon={TrendingDown} label="Avg loss" value={`-$${stats.avg_loss}`} tone="danger" />
          </div>

          {(stats.best_day || stats.worst_day) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {stats.best_day && (
              <div className="bg-surface border border-border rounded-2xl p-5">
                <p className="text-xs text-text-secondary mb-2">Best day</p>
                <p className="text-2xl font-medium text-success">+${stats.best_day.pnl.toLocaleString()}</p>
                <p className="text-xs text-text-muted mt-1">{stats.best_day.date}</p>
              </div>
            )}
            {stats.worst_day && (
              <div className="bg-surface border border-border rounded-2xl p-5">
                <p className="text-xs text-text-secondary mb-2">Worst day</p>
                <p className="text-2xl font-medium text-danger">${stats.worst_day.pnl.toLocaleString()}</p>
                <p className="text-xs text-text-muted mt-1">{stats.worst_day.date}</p>
              </div>
            )}
          </div>
          )}

          {stats.setup_breakdown.length > 0 && (
            <div className="mb-6">
              <SectionHeader icon={ListChecks} title="By setup" />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {stats.setup_breakdown.map((s) => (
                  <div key={s.setup_tag} className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.setup_tag}</p>
                      <p className="text-xs text-text-muted">{s.trade_count} trades · {s.win_rate}% win</p>
                    </div>
                    <p className={s.net_pnl >= 0 ? "text-success font-medium" : "text-danger font-medium"}>
                      {s.net_pnl >= 0 ? "+" : ""}${s.net_pnl.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(stats.emotion_breakdown.length > 0 || stats.session_breakdown.length > 0 || stats.revenge_trade_count > 0) && (
            <div className="mb-6">
              <SectionHeader icon={Brain} title="Psychology" />

              {stats.revenge_trade_count > 0 && (
                <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/30 rounded-2xl px-4 py-3 mb-4 text-danger text-sm">
                  <AlertTriangle size={15} className="flex-shrink-0" />
                  <span>
                    <strong>{stats.revenge_trade_count}</strong> potential revenge trade{stats.revenge_trade_count !== 1 ? "s" : ""} detected — trades opened within 30 minutes of a loss.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {stats.emotion_breakdown.length > 0 && (
                  <div className="bg-surface border border-border rounded-2xl p-5">
                    <p className="text-sm text-text-secondary mb-4">Win rate by emotional state</p>
                    <div className="space-y-2.5">
                      {stats.emotion_breakdown.map((e) => {
                        const meta = emotionMeta(e.emotional_state);
                        return (
                          <div key={e.emotional_state} className="flex items-center gap-3">
                            <span
                              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                meta.tone === "good" ? "bg-success" : meta.tone === "bad" ? "bg-danger" : "bg-text-muted"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-medium">{meta.label}</p>
                                <div className="flex items-center gap-2">
                                  <p className={`text-xs font-medium ${emotionToneClass(e.emotional_state)}`}>{e.win_rate}%</p>
                                  <p className={`text-xs ${e.net_pnl >= 0 ? "text-success" : "text-danger"}`}>
                                    {e.net_pnl >= 0 ? "+" : ""}${e.net_pnl.toLocaleString()}
                                  </p>
                                  <p className="text-xs text-text-muted">{e.trade_count}t</p>
                                </div>
                              </div>
                              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    meta.tone === "good" ? "bg-success" : meta.tone === "bad" ? "bg-danger" : "bg-accent"
                                  }`}
                                  style={{ width: `${e.win_rate}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {stats.session_breakdown.length > 0 && (
                  <div className="bg-surface border border-border rounded-2xl p-5">
                    <p className="text-sm text-text-secondary mb-4">Win rate by session</p>
                    <div className="space-y-2.5">
                      {stats.session_breakdown.map((s) => {
                        const labels: Record<string, string> = { london: "London", new_york: "New York", asia: "Asia", unknown: "Other" };
                        return (
                          <div key={s.session} className="flex items-center gap-3">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-accent" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-medium">{labels[s.session] ?? s.session}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-medium text-text-secondary">{s.win_rate}%</p>
                                  <p className={`text-xs ${s.net_pnl >= 0 ? "text-success" : "text-danger"}`}>
                                    {s.net_pnl >= 0 ? "+" : ""}${s.net_pnl.toLocaleString()}
                                  </p>
                                  <p className="text-xs text-text-muted">{s.trade_count}t</p>
                                </div>
                              </div>
                              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-accent" style={{ width: `${s.win_rate}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {stats.rule_adherence_trend.length > 1 && (
            <div className="mb-6">
              <SectionHeader icon={Activity} title="Rule adherence trend" />
              <div className="bg-surface border border-border rounded-2xl p-5 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <ReLineChart data={stats.rule_adherence_trend}>
                    <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#7a7a7a" }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#7a7a7a" }} tickLine={false} axisLine={false} unit="%" width={36} />
                    <Tooltip
                      contentStyle={{ background: "#262626", border: "1px solid #404040", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${v}%`, "Adherence"]}
                    />
                    <Line type="monotone" dataKey="adherence_percent" stroke="#378ADD" strokeWidth={2} dot={false} />
                  </ReLineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <p className="text-xs text-text-muted">{stats.closed_trades} closed trades in this account</p>
        </>
      )}

      <div className="mb-6 mt-6">
        <SectionHeader icon={Newspaper} title="Market news" />
        <div className="bg-surface border border-border rounded-2xl p-4">
          <NewsFeed />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof LineChart; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className="text-text-muted" />
      <p className="text-sm text-text-secondary">{title}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: {
  icon: typeof TrendingUp; label: string; value: string; tone?: "success" | "danger";
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={12} className="text-text-muted" />
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
      <p className={`text-xl font-medium ${tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
