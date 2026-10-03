import type {
  Account,
  AccountTransaction,
  EmotionBreakdown,
  RuleAdherencePoint,
  SessionBreakdown,
  SetupBreakdown,
  Stats,
  StoredTrade,
  Trade,
} from "../types";
import { calcHoldMinutes, calcPips, calcPnl, calcRMultiple, round } from "./calculations";

export const REVENGE_WINDOW_MINUTES = 30;

/** A closed trade with its account-currency P&L already computed (compute once, reuse everywhere). */
export type ClosedTrade = StoredTrade & { pnl: number; unconverted: boolean };

const isClosed = (t: StoredTrade) =>
  t.status === "closed" && t.exit_price !== null && t.exit_time !== null;

/**
 * Win rate excludes breakeven trades from the denominator: a scratch trade
 * is neither a win nor a loss, so it shouldn't drag the rate down.
 */
export function winRate(pnls: number[]): number {
  const wins = pnls.filter((p) => p > 0).length;
  const losses = pnls.filter((p) => p < 0).length;
  return wins + losses > 0 ? round((wins / (wins + losses)) * 100, 1) : 0;
}

export function pnlFor(trade: StoredTrade, account: Pick<Account, "currency"> | undefined) {
  return calcPnl({
    assetClass: trade.asset_class ?? "forex",
    pair: trade.pair,
    direction: trade.direction,
    entryPrice: trade.entry_price,
    exitPrice: trade.exit_price as number,
    lotSize: trade.lot_size,
    lotUnit: trade.lot_unit,
    commission: trade.commission ?? 0,
    swap: trade.swap ?? 0,
    accountCurrency: account?.currency,
    conversionRate: trade.conversion_rate,
  });
}

export function toClosedTrades(trades: StoredTrade[], accounts: Account[]): ClosedTrade[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return trades.filter(isClosed).map((t) => {
    const { pnl, unconverted } = pnlFor(t, byId.get(t.account_id));
    return { ...t, pnl, unconverted };
  });
}

const dayOf = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export function computeDailyPnl(closed: ClosedTrade[]): Record<string, number> {
  const daily: Record<string, number> = {};
  for (const t of closed) {
    const day = dayOf(t.exit_time as string);
    daily[day] = (daily[day] ?? 0) + t.pnl;
  }
  for (const d of Object.keys(daily)) daily[d] = round(daily[d], 2);
  return daily;
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

const sumPnl = (ts: ClosedTrade[]) => round(ts.reduce((a, t) => a + t.pnl, 0), 2);

export function computeSetupBreakdown(closed: ClosedTrade[]): SetupBreakdown[] {
  return [...groupBy(closed, (t) => t.setup_tag || "Untagged")]
    .map(([setup_tag, ts]) => ({
      setup_tag,
      trade_count: ts.length,
      win_rate: winRate(ts.map((t) => t.pnl)),
      net_pnl: sumPnl(ts),
    }))
    .sort((a, b) => b.net_pnl - a.net_pnl);
}

export function computeEmotionBreakdown(closed: ClosedTrade[]): EmotionBreakdown[] {
  return [...groupBy(closed, (t) => t.emotional_state || "untagged")]
    .map(([emotional_state, ts]) => {
      const conf = ts.map((t) => t.confidence_score).filter((c): c is number => c !== null && c !== undefined);
      return {
        emotional_state,
        trade_count: ts.length,
        win_rate: winRate(ts.map((t) => t.pnl)),
        net_pnl: sumPnl(ts),
        avg_confidence: conf.length ? round(conf.reduce((a, b) => a + b, 0) / conf.length, 1) : null,
      };
    })
    .sort((a, b) => b.net_pnl - a.net_pnl);
}

export function computeSessionBreakdown(closed: ClosedTrade[]): SessionBreakdown[] {
  return [...groupBy(closed, (t) => t.session || "unknown")]
    .map(([session, ts]) => ({
      session,
      trade_count: ts.length,
      win_rate: winRate(ts.map((t) => t.pnl)),
      net_pnl: sumPnl(ts),
    }))
    .sort((a, b) => b.net_pnl - a.net_pnl);
}

export function computeRuleAdherenceTrend(closed: ClosedTrade[]): RuleAdherencePoint[] {
  const daily = new Map<string, number[]>();
  for (const t of closed) {
    const checks = Object.values(t.rule_checks ?? {});
    if (!checks.length || !t.exit_time) continue;
    const pct = (checks.filter(Boolean).length / checks.length) * 100;
    const day = dayOf(t.exit_time);
    daily.set(day, [...(daily.get(day) ?? []), pct]);
  }
  return [...daily]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, vals]) => ({
      date,
      adherence_percent: round(vals.reduce((a, b) => a + b, 0) / vals.length, 1),
    }));
}

export function computeStreaks(closedSorted: ClosedTrade[]) {
  let longestWin = 0, longestLoss = 0, runWin = 0, runLoss = 0;
  for (const t of closedSorted) {
    if (t.pnl > 0) {
      runWin++; runLoss = 0;
      longestWin = Math.max(longestWin, runWin);
    } else if (t.pnl < 0) {
      runLoss++; runWin = 0;
      longestLoss = Math.max(longestLoss, runLoss);
    } else {
      runWin = 0; runLoss = 0;
    }
  }
  const last = closedSorted[closedSorted.length - 1];
  const current = !last ? 0 : last.pnl > 0 ? runWin : last.pnl < 0 ? -runLoss : 0;
  return { current_streak: current, longest_win_streak: longestWin, longest_loss_streak: longestLoss };
}

export function computeExpectancy(closed: ClosedTrade[]) {
  const pnls = closed.map((t) => t.pnl);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const n = pnls.length;
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
  // Per-trade expectancy over ALL trades: breakevens count as a zero outcome.
  const expectancy = n ? (wins.length / n) * avgWin - (losses.length / n) * avgLoss : 0;
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  return {
    expectancy: round(expectancy, 2),
    profit_factor: grossLoss > 0 ? round(grossProfit / grossLoss, 2) : 0,
    avg_win: round(avgWin, 2),
    avg_loss: round(avgLoss, 2),
  };
}

export function computeBestWorstDay(daily: Record<string, number>) {
  const days = Object.keys(daily);
  if (!days.length) return { best_day: null, worst_day: null };
  const best = days.reduce((a, b) => (daily[b] > daily[a] ? b : a));
  const worst = days.reduce((a, b) => (daily[b] < daily[a] ? b : a));
  return {
    best_day: { date: best, pnl: daily[best] },
    worst_day: { date: worst, pnl: daily[worst] },
  };
}

/**
 * Flags revenge trades in ONE pass over an account's trades (sorted by entry
 * time ascending): a trade is flagged if it opened within `windowMinutes` of
 * the exit of the immediately preceding closed trade, and that trade lost.
 * `pnlById` supplies the (already computed) P&L of closed trades.
 */
export function flagRevengeTrades(
  tradesAsc: StoredTrade[],
  pnlById: Map<string, number>,
  windowMinutes = REVENGE_WINDOW_MINUTES
): Map<string, boolean> {
  const flags = new Map<string, boolean>();
  let lastLossExit: number | null = null;
  for (const t of tradesAsc) {
    const entry = Date.parse(t.entry_time);
    let revenge = false;
    if (lastLossExit !== null && !Number.isNaN(entry)) {
      const gap = (entry - lastLossExit) / 60000;
      revenge = gap >= 0 && gap <= windowMinutes;
    }
    flags.set(t.id, revenge);
    if (isClosed(t) && pnlById.has(t.id)) {
      lastLossExit = (pnlById.get(t.id) as number) < 0 ? Date.parse(t.exit_time as string) : null;
    }
  }
  return flags;
}

/** Revenge flags for every account in the dataset, keyed by trade id. Computed per account so accounts never mix. */
export function revengeFlagsByAccount(
  trades: StoredTrade[],
  accounts: Account[]
): Map<string, boolean> {
  const closed = toClosedTrades(trades, accounts);
  const pnlById = new Map(closed.map((t) => [t.id, t.pnl]));
  const out = new Map<string, boolean>();
  for (const [, ts] of groupBy(trades, (t) => t.account_id)) {
    const asc = [...ts].sort((a, b) => Date.parse(a.entry_time) - Date.parse(b.entry_time));
    for (const [id, f] of flagRevengeTrades(asc, pnlById)) out.set(id, f);
  }
  return out;
}

export function enrichTrade(
  t: StoredTrade,
  account: Pick<Account, "currency"> | undefined,
  isRevenge = false
): Trade {
  const closed = t.exit_price !== null && t.exit_price !== undefined;
  let pips: number | null = null, pnl: number | null = null, r: number | null = null;
  let unconverted = false;
  if (closed) {
    const exit = t.exit_price as number;
    pips = calcPips(t.asset_class ?? "forex", t.pair, t.direction, t.entry_price, exit);
    const res = pnlFor(t, account);
    pnl = res.pnl;
    unconverted = res.unconverted;
    r = calcRMultiple(t.direction, t.entry_price, exit, t.initial_sl);
  }
  const checks = Object.values(t.rule_checks ?? {});
  return {
    ...t,
    tags: t.tags ?? [],
    rule_checks: t.rule_checks ?? {},
    pips,
    pnl,
    r_multiple: r,
    pnl_unconverted: unconverted,
    hold_minutes: calcHoldMinutes(t.entry_time, t.exit_time),
    rule_adherence_percent: checks.length
      ? round((checks.filter(Boolean).length / checks.length) * 100, 1)
      : null,
    is_revenge_trade: isRevenge,
  };
}

export interface StatsInput {
  accounts: Account[];
  trades: StoredTrade[];
  transactions: AccountTransaction[];
  /** Inclusive ISO bounds on trade entry time / transaction date. */
  from?: string;
  to?: string;
}

/**
 * Overview statistics for one or more accounts.
 *
 * A trade belongs to the period in which it was OPENED (same rule as the
 * Journal list). With a date range, the equity curve starts from the balance
 * at the beginning of the window (starting balance + everything that happened
 * before it), and peak/drawdown are measured inside the window only.
 */
export function computeStats(input: StatsInput): Stats {
  const { accounts, transactions } = input;
  const ids = new Set(accounts.map((a) => a.id));
  const allTrades = input.trades.filter((t) => ids.has(t.account_id));
  const allTx = transactions.filter((x) => ids.has(x.account_id));

  const fromMs = input.from ? Date.parse(input.from) : -Infinity;
  const toMs = input.to ? Date.parse(input.to) : Infinity;
  const hasRange = fromMs !== -Infinity || toMs !== Infinity;

  const before = (iso: string) => Date.parse(iso) < fromMs;
  const inside = (iso: string) => {
    const ms = Date.parse(iso);
    return ms >= fromMs && ms <= toMs;
  };

  const allClosed = toClosedTrades(allTrades, accounts);
  const closed = allClosed.filter((t) => inside(t.entry_time));
  const windowTrades = allTrades.filter((t) => inside(t.entry_time));
  const openCount = windowTrades.filter((t) => t.status === "open").length;

  const txDelta = (x: AccountTransaction) => (x.type === "withdrawal" ? -x.amount : x.amount);

  // Opening balance for the window.
  let equity = accounts.reduce((a, acc) => a + Number(acc.starting_balance), 0);
  if (hasRange) {
    equity += allClosed.filter((t) => before(t.entry_time)).reduce((a, t) => a + t.pnl, 0);
    equity += allTx.filter((x) => before(x.occurred_at)).reduce((a, x) => a + txDelta(x), 0);
  }
  const opening = round(equity, 2);

  const events = [
    ...closed.map((t) => ({ time: t.exit_time as string, delta: t.pnl })),
    ...allTx.filter((x) => inside(x.occurred_at)).map((x) => ({ time: x.occurred_at, delta: txDelta(x) })),
  ].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));

  const startTime =
    input.from ?? accounts.map((a) => a.created_at).sort()[0] ?? new Date().toISOString();
  const curve: { time: string; equity: number }[] = [{ time: startTime, equity: opening }];
  let peak = equity;
  let maxDrawdown = 0;
  for (const e of events) {
    equity += e.delta;
    curve.push({ time: e.time, equity: round(equity, 2) });
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
  }

  const pnls = closed.map((t) => t.pnl);
  const rs = closed
    .map((t) => calcRMultiple(t.direction, t.entry_price, t.exit_price as number, t.initial_sl))
    .filter((r): r is number => r !== null);
  const holds = closed
    .map((t) => calcHoldMinutes(t.entry_time, t.exit_time))
    .filter((h): h is number => h !== null);

  const closedSorted = [...closed].sort((a, b) => Date.parse(a.exit_time as string) - Date.parse(b.exit_time as string));
  const daily = computeDailyPnl(closed);
  const exp = computeExpectancy(closed);

  // Revenge flags need the account's full history for context, then count only trades in the window.
  const flags = revengeFlagsByAccount(allTrades, accounts);
  const revengeCount = windowTrades.filter((t) => flags.get(t.id)).length;

  return {
    win_rate: winRate(pnls),
    avg_r_multiple: rs.length ? round(rs.reduce((a, b) => a + b, 0) / rs.length, 2) : 0,
    net_pnl: round(pnls.reduce((a, b) => a + b, 0), 2),
    current_balance: round(equity, 2),
    avg_hold_minutes: holds.length ? Math.trunc(holds.reduce((a, b) => a + b, 0) / holds.length) : 0,
    max_drawdown: round(maxDrawdown, 2),
    open_trades: openCount,
    closed_trades: closed.length,
    breakeven_trades: pnls.filter((p) => p === 0).length,
    unconverted_trades: closed.filter((t) => t.unconverted).length,
    equity_curve: curve,
    daily_pnl: daily,
    setup_breakdown: computeSetupBreakdown(closed),
    emotion_breakdown: computeEmotionBreakdown(closed),
    session_breakdown: computeSessionBreakdown(closed),
    rule_adherence_trend: computeRuleAdherenceTrend(closed),
    revenge_trade_count: revengeCount,
    ...computeStreaks(closedSorted),
    ...exp,
    ...computeBestWorstDay(daily),
  };
}
