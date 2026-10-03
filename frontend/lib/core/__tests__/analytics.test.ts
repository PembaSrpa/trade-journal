import { describe, expect, it } from "vitest";
import {
  computeBestWorstDay, computeDailyPnl, computeEmotionBreakdown, computeExpectancy,
  computeRuleAdherenceTrend, computeSessionBreakdown, computeSetupBreakdown, computeStats,
  computeStreaks, enrichTrade, flagRevengeTrades, revengeFlagsByAccount, toClosedTrades, winRate,
} from "../analytics";
import type { AccountTransaction } from "../../types";
import { account, trade } from "./helpers";

const acc = account();
const closed = (...ts: ReturnType<typeof trade>[]) => toClosedTrades(ts, [acc]);
const day = (d: number, entry = 1.0, exit = 1.01, extra = {}) => {
  const dd = String(d).padStart(2, "0");
  return trade({
    entry_time: `2026-07-${dd}T09:00:00.000Z`, exit_time: `2026-07-${dd}T10:00:00.000Z`,
    entry_price: entry, exit_price: exit, ...extra,
  });
};

describe("daily / setup / streaks / expectancy (ported)", () => {
  it("daily pnl groups by exit date", () => {
    const d = computeDailyPnl(closed(
      trade({ exit_time: "2026-07-28T10:00:00Z" }),
      trade({ exit_time: "2026-07-28T14:00:00Z", direction: "short", exit_price: 0.99 }),
      trade({ exit_time: "2026-07-29T10:00:00Z", exit_price: 1.02 }),
    ));
    expect(Object.keys(d).sort()).toEqual(["2026-07-28", "2026-07-29"]);
    expect(d["2026-07-28"]).toBeGreaterThan(0);
  });
  it("setup breakdown sorts by pnl, has Untagged bucket", () => {
    const b = computeSetupBreakdown(closed(
      trade({ setup_tag: "Breakout", exit_price: 1.02 }),
      trade({ setup_tag: "News", exit_price: 0.98 }),
      trade({ setup_tag: null }),
    ));
    expect(b[0].setup_tag).toBe("Breakout");
    expect(b.map((x) => x.setup_tag)).toContain("Untagged");
  });
  it("streaks", () => {
    expect(computeStreaks(closed(day(20), day(21), day(22)))).toEqual({ current_streak: 3, longest_win_streak: 3, longest_loss_streak: 0 });
    expect(computeStreaks(closed(day(20), day(21), day(22, 1.0, 0.99)))).toEqual({ current_streak: -1, longest_win_streak: 2, longest_loss_streak: 1 });
    expect(computeStreaks([])).toEqual({ current_streak: 0, longest_win_streak: 0, longest_loss_streak: 0 });
  });
  it("expectancy / profit factor guards", () => {
    const r = computeExpectancy(closed(day(20, 1, 1.02), day(21, 1, 0.99)));
    expect(r.avg_win).toBeGreaterThan(0);
    expect(r.avg_loss).toBeGreaterThan(0);
    expect(r.profit_factor).toBeGreaterThan(0);
    const onlyWins = computeExpectancy(closed(day(20, 1, 1.02)));
    expect(onlyWins.avg_loss).toBe(0);
    expect(onlyWins.profit_factor).toBe(0);
  });
  it("best/worst day", () => {
    const r = computeBestWorstDay({ "2026-07-28": 100, "2026-07-29": -50, "2026-07-30": 20 });
    expect(r.best_day?.date).toBe("2026-07-28");
    expect(r.worst_day?.date).toBe("2026-07-29");
    expect(computeBestWorstDay({})).toEqual({ best_day: null, worst_day: null });
  });
});

describe("psychology analytics (ported)", () => {
  it("emotion breakdown", () => {
    const b = computeEmotionBreakdown(closed(
      trade({ emotional_state: "confident", confidence_score: 4, exit_price: 1.02 }),
      trade({ emotional_state: "confident", confidence_score: 5, exit_price: 1.01 }),
      trade({ emotional_state: "fomo", confidence_score: 2, exit_price: 0.98 }),
      trade({}),
    ));
    const m = Object.fromEntries(b.map((x) => [x.emotional_state, x]));
    expect(m.confident.avg_confidence).toBe(4.5);
    expect(m.confident.win_rate).toBe(100);
    expect(m.fomo.win_rate).toBe(0);
    expect(m.untagged.avg_confidence).toBeNull();
  });
  it("session breakdown", () => {
    const b = computeSessionBreakdown(closed(trade({ session: "london" }), trade({ session: "new_york", exit_price: 0.99 })));
    expect(new Set(b.map((x) => x.session))).toEqual(new Set(["london", "new_york"]));
  });
  it("rule adherence trend averages per day and skips empty", () => {
    expect(computeRuleAdherenceTrend(closed(
      trade({ rule_checks: { a: true, b: false } }),
      trade({ rule_checks: { a: true, b: true } }),
    ))).toEqual([{ date: "2026-07-28", adherence_percent: 75 }]);
    expect(computeRuleAdherenceTrend(closed(trade({})))).toEqual([]);
  });
});

describe("revenge flags", () => {
  const T = (id: string, entry: string, exit: string | null, exitPrice: number | null = 0.99) =>
    trade({ id, entry_time: entry, exit_time: exit, exit_price: exitPrice, status: exit ? "closed" : "open" });
  const flags = (ts: ReturnType<typeof trade>[]) => {
    const cl = toClosedTrades(ts, [acc]);
    return flagRevengeTrades(ts, new Map(cl.map((t) => [t.id, t.pnl])));
  };
  it("flagged after a quick loss", () => {
    const f = flags([T("1", "2026-07-28T10:00:00Z", "2026-07-28T10:30:00Z"), T("2", "2026-07-28T10:40:00Z", "2026-07-28T11:00:00Z", 1.01)]);
    expect(f.get("1")).toBe(false);
    expect(f.get("2")).toBe(true);
  });
  it("not after a win / outside window", () => {
    expect(flags([T("1", "2026-07-28T10:00:00Z", "2026-07-28T10:30:00Z", 1.01), T("2", "2026-07-28T10:40:00Z", "2026-07-28T11:00:00Z")]).get("2")).toBe(false);
    expect(flags([T("1", "2026-07-28T10:00:00Z", "2026-07-28T10:30:00Z"), T("2", "2026-07-28T14:00:00Z", "2026-07-28T15:00:00Z")]).get("2")).toBe(false);
  });
  it("an open trade still gets flagged", () => {
    expect(flags([T("1", "2026-07-28T10:00:00Z", "2026-07-28T10:30:00Z"), T("2", "2026-07-28T10:35:00Z", null, null)]).get("2")).toBe(true);
  });
  it("never mixes accounts", () => {
    const a2 = account({ id: "a2" });
    const ts = [
      trade({ id: "x1", account_id: "a1", entry_time: "2026-07-28T10:00:00Z", exit_time: "2026-07-28T10:30:00Z", exit_price: 0.99 }),
      trade({ id: "x2", account_id: "a2", entry_time: "2026-07-28T10:35:00Z", exit_time: "2026-07-28T11:00:00Z", exit_price: 1.01 }),
    ];
    expect(revengeFlagsByAccount(ts, [acc, a2]).get("x2")).toBe(false);
  });
});

describe("enrichTrade (ported)", () => {
  const base = () => trade({
    entry_price: 1.0842, exit_price: 1.0891, initial_sl: 1.0812,
    entry_time: "2026-07-28T08:15:00Z", exit_time: "2026-07-28T10:40:00Z",
  });
  it("computes pips/pnl/R/hold", () => {
    const r = enrichTrade(base(), acc);
    expect([r.pips, r.pnl, r.r_multiple, r.hold_minutes]).toEqual([49, 490, 1.63, 145]);
  });
  it("open trade has no outcome fields", () => {
    const r = enrichTrade(trade({ status: "open", exit_price: null, exit_time: null }), acc);
    expect([r.pips, r.pnl, r.r_multiple, r.hold_minutes]).toEqual([null, null, null, null]);
  });
  it("does not mutate input", () => {
    const t = base();
    const copy = JSON.parse(JSON.stringify(t));
    enrichTrade(t, acc);
    expect(t).toEqual(copy);
  });
  it("rule adherence", () => {
    expect(enrichTrade(trade({ rule_checks: { a: true, b: true, c: false } }), acc).rule_adherence_percent).toBeCloseTo(66.7, 1);
    expect(enrichTrade(trade(), acc).rule_adherence_percent).toBeNull();
    expect(enrichTrade(trade({ rule_checks: { a: true, b: true } }), acc).rule_adherence_percent).toBe(100);
  });
  it("flags unconverted cross-pair pnl", () => {
    expect(enrichTrade(trade({ pair: "EUR/GBP", entry_price: 0.85, exit_price: 0.852 }), acc).pnl_unconverted).toBe(true);
  });
});

describe("breakeven handling (fix #8)", () => {
  it("excluded from the win-rate denominator", () => {
    expect(winRate([100, -50, 0, 0])).toBe(50);
    expect(winRate([0, 0])).toBe(0);
  });
  it("stats expose a breakeven count; expectancy still counts them as zero outcomes", () => {
    const s = computeStats({
      accounts: [acc], transactions: [],
      trades: [day(20, 1, 1.01), day(21, 1, 0.99), day(22, 1, 1.0), day(23, 1, 1.0)],
    });
    expect(s.closed_trades).toBe(4);
    expect(s.breakeven_trades).toBe(2);
    expect(s.win_rate).toBe(50);
    expect(s.expectancy).toBe(0); // (1/4)*1000 - (1/4)*1000
  });
});

describe("equity curve with a date range (fix #3)", () => {
  const trades = [day(10, 1, 1.01), day(15, 1, 1.02), day(20, 1, 0.99)];
  const tx: AccountTransaction[] = [
    { id: "d1", account_id: "a1", type: "deposit", amount: 5000, occurred_at: "2026-07-12T00:00:00.000Z", created_at: "x" },
    { id: "w1", account_id: "a1", type: "withdrawal", amount: 1000, occurred_at: "2026-07-25T00:00:00.000Z", created_at: "x" },
  ];

  it("no range: full history from the starting balance", () => {
    const s = computeStats({ accounts: [acc], trades, transactions: tx });
    // 10000 + 1000 + 2000 - 1000 + 5000 - 1000 = 16000
    expect(s.current_balance).toBe(16000);
  });
  it("range starts from the balance at the window start, not the starting balance", () => {
    const s = computeStats({ accounts: [acc], trades, transactions: tx, from: "2026-07-14T00:00:00.000Z" });
    // before window: 10000 + 1000 (day 10) + 5000 (deposit) = 16000
    expect(s.equity_curve[0].equity).toBe(16000);
    // in window: +2000 (day 15), -1000 (day 20), -1000 withdrawal => 16000
    expect(s.current_balance).toBe(16000);
    expect(s.closed_trades).toBe(2);
    expect(s.net_pnl).toBe(1000);
  });
  it("drawdown is measured inside the window only", () => {
    const losing = [day(5, 1, 0.9), day(20, 1, 1.01)]; // big loss BEFORE the window
    const s = computeStats({ accounts: [acc], trades: losing, transactions: [], from: "2026-07-10T00:00:00.000Z" });
    expect(s.max_drawdown).toBe(0);
    const all = computeStats({ accounts: [acc], trades: losing, transactions: [] });
    expect(all.max_drawdown).toBeGreaterThan(0);
  });
  it("range + to: later trades excluded from the balance", () => {
    const s = computeStats({ accounts: [acc], trades, transactions: tx, to: "2026-07-16T00:00:00.000Z" });
    expect(s.closed_trades).toBe(2);
    expect(s.current_balance).toBe(10000 + 1000 + 2000 + 5000);
  });
  it("revenge trades before the window still give context to the first trade inside it", () => {
    const ts = [
      trade({ id: "L", entry_time: "2026-07-09T23:00:00Z", exit_time: "2026-07-09T23:50:00Z", exit_price: 0.99 }),
      trade({ id: "R", entry_time: "2026-07-10T00:10:00Z", exit_time: "2026-07-10T01:00:00Z" }),
    ];
    const s = computeStats({ accounts: [acc], trades: ts, transactions: [], from: "2026-07-10T00:00:00Z" });
    expect(s.revenge_trade_count).toBe(1);
  });
});

describe("combined accounts", () => {
  it("sums starting balances", () => {
    const a2 = account({ id: "a2", starting_balance: 5000 });
    const s = computeStats({ accounts: [acc, a2], trades: [], transactions: [] });
    expect(s.current_balance).toBe(15000);
  });
});
