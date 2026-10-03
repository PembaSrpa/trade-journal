import { beforeEach, describe, expect, it } from "vitest";
import { Repo } from "../repo";
import { MemoryStore } from "../store";
import type { Account, Playbook, Stats, Trade } from "../../types";

let repo: Repo;
let acc: Account;

const tradeBody = (over: Record<string, unknown> = {}) => ({
  account_id: acc.id, pair: "EUR/USD", direction: "long", entry_price: 1.0842, exit_price: 1.0891,
  initial_sl: 1.0812, lot_size: 1, lot_unit: "standard",
  entry_time: "2026-07-28T08:15:00Z", exit_time: "2026-07-28T10:40:00Z", ...over,
});

beforeEach(async () => {
  repo = new Repo(new MemoryStore());
  acc = await repo.handle<Account>("POST", "/accounts", { name: "Main", type: "demo", currency: "USD", starting_balance: 10000 });
});

describe("accounts", () => {
  it("create / list / archive / delete with cascade", async () => {
    expect((await repo.handle<Account[]>("GET", "/accounts")).map((a) => a.name)).toEqual(["Main"]);
    const t = await repo.handle<Trade>("POST", "/trades", tradeBody());
    await repo.handle("POST", "/notebook", { account_id: acc.id, entry_date: "2026-07-28", content: "x" });
    await repo.handle("POST", "/playbooks", { account_id: acc.id, name: "P", rules: [{ rule_text: "r" }] });
    await repo.handle("PATCH", `/accounts/${acc.id}/archive`, {});
    expect(await repo.handle<Account[]>("GET", "/accounts")).toHaveLength(0);
    expect(await repo.handle<Account[]>("GET", "/accounts?include_archived=true")).toHaveLength(1);
    await repo.handle("DELETE", `/accounts/${acc.id}`);
    await expect(repo.handle("GET", `/trades/${t.id}`)).rejects.toThrow(/not found/);
    expect(await repo.raw.getAll("notebook")).toHaveLength(0);
    expect(await repo.raw.getAll("playbooks")).toHaveLength(0);
  });
  it("rejects bad input", async () => {
    await expect(repo.handle("POST", "/accounts", { name: "", type: "demo", starting_balance: 1 })).rejects.toThrow();
    await expect(repo.handle("POST", "/accounts", { name: "x", type: "weird", starting_balance: 1 })).rejects.toThrow();
  });
});

describe("trades", () => {
  it("create enriches pips/pnl/R/hold and sets session", async () => {
    const t = await repo.handle<Trade>("POST", "/trades", tradeBody());
    expect([t.pips, t.pnl, t.r_multiple, t.hold_minutes, t.session, t.status]).toEqual([49, 490, 1.63, 145, "london", "closed"]);
  });
  it("without exit_time it's open", async () => {
    const t = await repo.handle<Trade>("POST", "/trades", tradeBody({ exit_price: null, exit_time: null }));
    expect([t.status, t.pnl]).toEqual(["open", null]);
  });
  it("validates", async () => {
    await expect(repo.handle("POST", "/trades", tradeBody({ direction: "up" }))).rejects.toThrow();
    await expect(repo.handle("POST", "/trades", tradeBody({ confidence_score: 9 }))).rejects.toThrow();
    await expect(repo.handle("POST", "/trades", tradeBody({ account_id: "nope" }))).rejects.toThrow(/not found/);
    await expect(repo.handle("POST", "/trades", tradeBody({ exit_price: null }))).rejects.toThrow(/exit price/);
  });
  it("rejects a playbook from another account (ownership check)", async () => {
    const other = await repo.handle<Account>("POST", "/accounts", { name: "B", type: "demo", starting_balance: 1 });
    const pb = await repo.handle<Playbook>("POST", "/playbooks", { account_id: other.id, name: "P" });
    await expect(repo.handle("POST", "/trades", tradeBody({ playbook_id: pb.id }))).rejects.toThrow(/Playbook/);
  });
  it("PATCH recomputes derived values and session", async () => {
    const t = await repo.handle<Trade>("POST", "/trades", tradeBody());
    const u = await repo.handle<Trade>("PATCH", `/trades/${t.id}`, { exit_price: 1.0942, entry_time: "2026-07-28T14:00:00Z" });
    expect(u.pips).toBe(100);
    expect(u.session).toBe("new_york");
  });
  it("clearing exit_price reopens the trade (fix #7)", async () => {
    const t = await repo.handle<Trade>("POST", "/trades", tradeBody({ exit_type: "tp_hit" }));
    const u = await repo.handle<Trade>("PATCH", `/trades/${t.id}`, { exit_price: null });
    expect([u.status, u.exit_price, u.exit_time, u.exit_type, u.pnl]).toEqual(["open", null, null, null, null]);
  });
  it("setting an exit price on an open trade closes it", async () => {
    const t = await repo.handle<Trade>("POST", "/trades", tradeBody({ exit_price: null, exit_time: null }));
    const u = await repo.handle<Trade>("PATCH", `/trades/${t.id}`, { exit_price: 1.09 });
    expect([u.status, u.pnl !== null, u.exit_time !== null]).toEqual(["closed", true, true]);
  });
  it("risk_percent round-trips (fix #7)", async () => {
    const t = await repo.handle<Trade>("POST", "/trades", tradeBody({ risk_percent: 1.5 }));
    expect(t.risk_percent).toBe(1.5);
    expect((await repo.handle<Trade>("PATCH", `/trades/${t.id}`, { risk_percent: 2 })).risk_percent).toBe(2);
  });
  it("list: paging, sort, range, flags revenge, never leaks other accounts", async () => {
    for (let i = 0; i < 12; i++) {
      await repo.handle("POST", "/trades", tradeBody({
        entry_time: `2026-07-${String(10 + i).padStart(2, "0")}T08:00:00Z`,
        exit_time: `2026-07-${String(10 + i).padStart(2, "0")}T09:00:00Z`,
      }));
    }
    const p1 = await repo.handle<Trade[]>("GET", `/trades?account_id=${acc.id}&page=1&page_size=10`);
    const p2 = await repo.handle<Trade[]>("GET", `/trades?account_id=${acc.id}&page=2&page_size=10`);
    expect([p1.length, p2.length]).toEqual([10, 2]);
    expect(p1[0].entry_time > p1[1].entry_time).toBe(true);
    const asc = await repo.handle<Trade[]>("GET", `/trades?account_id=${acc.id}&sort=asc&page_size=50`);
    expect(asc[0].entry_time < asc[1].entry_time).toBe(true);
    const ranged = await repo.handle<Trade[]>("GET", `/trades?account_id=${acc.id}&from=2026-07-20T00:00:00Z&page_size=50`);
    expect(ranged).toHaveLength(2);

    const loss = await repo.handle<Trade>("POST", "/trades", tradeBody({ entry_time: "2026-08-01T10:00:00Z", exit_time: "2026-08-01T10:30:00Z", exit_price: 1.0 }));
    const next = await repo.handle<Trade>("POST", "/trades", tradeBody({ entry_time: "2026-08-01T10:40:00Z", exit_time: "2026-08-01T11:00:00Z" }));
    expect(loss.is_revenge_trade).toBe(false);
    expect((await repo.handle<Trade>("GET", `/trades/${next.id}`)).is_revenge_trade).toBe(true);
  });
  it("delete removes the trade and its screenshot", async () => {
    await repo.raw.putMany("screenshots", [{ id: "s1", trade_id: null, data_url: "data:image/png;base64,AA" }]);
    const t = await repo.handle<Trade>("POST", "/trades", tradeBody({ screenshot_url: "s1" }));
    expect((await repo.raw.get<{ trade_id: string }>("screenshots", "s1"))?.trade_id).toBe(t.id);
    await repo.handle("DELETE", `/trades/${t.id}`);
    expect(await repo.raw.get("screenshots", "s1")).toBeUndefined();
  });
});

describe("stats via the repo", () => {
  it("per account, combined by type, cached until a write", async () => {
    await repo.handle("POST", "/trades", tradeBody());
    const a = await repo.handle<Stats>("GET", `/stats?account_id=${acc.id}`);
    expect(a.net_pnl).toBe(490);
    expect(await repo.handle<Stats>("GET", `/stats?account_id=${acc.id}`)).toBe(a); // memoized
    await repo.handle("POST", "/trades", tradeBody({ entry_time: "2026-07-29T08:00:00Z", exit_time: "2026-07-29T09:00:00Z" }));
    expect((await repo.handle<Stats>("GET", `/stats?account_id=${acc.id}`)).net_pnl).toBe(980); // invalidated
    expect((await repo.handle<Stats>("GET", "/stats?account_type=demo")).closed_trades).toBe(2);
    await expect(repo.handle("GET", "/stats?account_type=live")).rejects.toThrow(/not found/);
    await expect(repo.handle("GET", "/stats")).rejects.toThrow();
  });
  it("honors a date range with the correct opening balance", async () => {
    await repo.handle("POST", "/trades", tradeBody({ entry_time: "2026-07-01T08:00:00Z", exit_time: "2026-07-01T09:00:00Z" }));
    await repo.handle("POST", "/trades", tradeBody({ entry_time: "2026-07-20T08:00:00Z", exit_time: "2026-07-20T09:00:00Z" }));
    const s = await repo.handle<Stats>("GET", `/stats?account_id=${acc.id}&from_date=2026-07-10T00:00:00Z`);
    expect(s.equity_curve[0].equity).toBe(10490);
    expect(s.current_balance).toBe(10980);
  });
});

describe("notebook / playbooks / export", () => {
  it("notebook upsert is one entry per day", async () => {
    const a = await repo.handle<{ id: string }>("POST", "/notebook", { account_id: acc.id, entry_date: "2026-07-28", content: "one" });
    const b = await repo.handle<{ id: string; content: string }>("POST", "/notebook", { account_id: acc.id, entry_date: "2026-07-28", content: "two" });
    expect(b.id).toBe(a.id);
    expect(await repo.handle<unknown[]>("GET", `/notebook?account_id=${acc.id}`)).toHaveLength(1);
    expect((await repo.handle<{ content: string }>("GET", `/notebook/by-date?account_id=${acc.id}&entry_date=2026-07-28`)).content).toBe("two");
    expect(await repo.handle("GET", `/notebook/by-date?account_id=${acc.id}&entry_date=2000-01-01`)).toBeNull();
    await expect(repo.handle("POST", "/notebook", { account_id: acc.id, entry_date: "28/07", content: "" })).rejects.toThrow();
  });
  it("playbook archive hides it", async () => {
    const p = await repo.handle<Playbook>("POST", "/playbooks", { account_id: acc.id, name: "P", rules: [{ rule_text: "a" }, { rule_text: "b" }] });
    expect(p.rules.map((r) => r.sort_order)).toEqual([0, 1]);
    await repo.handle("PATCH", `/playbooks/${p.id}/archive`, {});
    expect(await repo.handle<Playbook[]>("GET", `/playbooks?account_id=${acc.id}`)).toHaveLength(0);
  });
  it("CSV export honors the range and escapes", async () => {
    await repo.handle("POST", "/trades", tradeBody({ setup_tag: 'Pull, "back"', entry_time: "2026-07-01T08:00:00Z", exit_time: "2026-07-01T09:00:00Z" }));
    await repo.handle("POST", "/trades", tradeBody({ entry_time: "2026-07-20T08:00:00Z", exit_time: "2026-07-20T09:00:00Z" }));
    const all = await repo.handle<{ text: string }>("GET", `/export?account_id=${acc.id}&format=csv`);
    expect(all.text.split("\n")).toHaveLength(3);
    expect(all.text).toContain('"Pull, ""back"""');
    const some = await repo.handle<{ text: string }>("GET", `/export?account_id=${acc.id}&format=csv&from=2026-07-10T00:00:00Z`);
    expect(some.text.split("\n")).toHaveLength(2);
  });
});
