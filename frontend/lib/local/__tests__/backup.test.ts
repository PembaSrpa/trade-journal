import { describe, expect, it } from "vitest";
import { BackupError, buildBackup, importBackup, parseBackup } from "../backup";
import { Repo } from "../repo";
import { MemoryStore } from "../store";
import type { Account, Playbook, Trade } from "../../types";

async function seeded() {
  const store = new MemoryStore();
  const repo = new Repo(store);
  const acc = await repo.handle<Account>("POST", "/accounts", { name: "Main", type: "live", currency: "USD", starting_balance: 5000 });
  const pb = await repo.handle<Playbook>("POST", "/playbooks", { account_id: acc.id, name: "PB", rules: [{ rule_text: "a" }] });
  await repo.raw.putMany("screenshots", [{ id: "s1", trade_id: null, data_url: "data:image/png;base64,iVBOR" }]);
  const t = await repo.handle<Trade>("POST", "/trades", {
    account_id: acc.id, pair: "EUR/USD", direction: "long", entry_price: 1.1, exit_price: 1.11, lot_size: 1,
    entry_time: "2026-07-28T08:00:00Z", exit_time: "2026-07-28T09:00:00Z",
    tags: ["A+", "FOMO"], playbook_id: pb.id, rule_checks: { [pb.rules[0].id]: true }, screenshot_url: "s1",
    emotional_state: "calm", confidence_score: 4, risk_percent: 1,
  });
  await repo.handle("POST", "/notebook", { account_id: acc.id, entry_date: "2026-07-28", content: "recap" });
  await repo.raw.putMany("transactions", [{ id: "x1", account_id: acc.id, type: "deposit", amount: 100, occurred_at: "2026-07-27T00:00:00.000Z", created_at: "2026-07-27T00:00:00.000Z" }]);
  return { store, repo, acc, t };
}

describe("export -> import round trip", () => {
  it("restores everything, including screenshots, into an empty app", async () => {
    const { store, t } = await seeded();
    const text = JSON.stringify(await buildBackup(store));

    const fresh = new MemoryStore();
    const report = await importBackup(fresh, parseBackup(text), "replace");
    expect(report.added).toEqual({ accounts: 1, trades: 1, playbooks: 1, notebook: 1, transactions: 1, screenshots: 1 });

    const repo2 = new Repo(fresh);
    const back = await repo2.handle<Trade>("GET", `/trades/${t.id}`);
    expect(back.pnl).toBe(t.pnl);
    expect(back.tags).toEqual(["A+", "FOMO"]);
    expect(back.risk_percent).toBe(1);
    expect(back.rule_adherence_percent).toBe(100);
    expect((await fresh.get<{ data_url: string }>("screenshots", "s1"))?.data_url).toContain("iVBOR");
  });
  it("is stable: export of an imported backup equals the original data", async () => {
    const { store } = await seeded();
    const a = await buildBackup(store);
    const fresh = new MemoryStore();
    await importBackup(fresh, parseBackup(JSON.stringify(a)), "replace");
    const b = await buildBackup(fresh);
    expect(b.data).toEqual(a.data);
  });
});

describe("merge", () => {
  it("never duplicates and never overwrites existing records", async () => {
    const { store, repo, t } = await seeded();
    const backup = parseBackup(JSON.stringify(await buildBackup(store)));
    await repo.handle("PATCH", `/trades/${t.id}`, { lesson: "edited after backup" });
    const r = await importBackup(store, backup, "merge");
    expect(Object.values(r.added).every((n) => n === 0)).toBe(true);
    expect((await store.getAll("trades"))).toHaveLength(1);
    expect((await repo.handle<Trade>("GET", `/trades/${t.id}`)).lesson).toBe("edited after backup");
  });
  it("adds only what's missing", async () => {
    const { store } = await seeded();
    const backup = parseBackup(JSON.stringify(await buildBackup(store)));
    await store.deleteMany("trades", [backup.data.trades[0].id]);
    const r = await importBackup(store, backup, "merge");
    expect(r.added.trades).toBe(1);
    expect(r.skipped.accounts).toBe(1);
  });
  it("merging into another device's data keeps both", async () => {
    const { store } = await seeded();
    const backup = parseBackup(JSON.stringify(await buildBackup(store)));
    const other = new MemoryStore();
    const orepo = new Repo(other);
    await orepo.handle("POST", "/accounts", { name: "Other", type: "demo", starting_balance: 1 });
    await importBackup(other, backup, "merge");
    expect((await other.getAll("accounts"))).toHaveLength(2);
  });
});

describe("replace", () => {
  it("wipes existing data", async () => {
    const { store } = await seeded();
    const backup = parseBackup(JSON.stringify(await buildBackup(store)));
    const other = new MemoryStore();
    await new Repo(other).handle("POST", "/accounts", { name: "Old", type: "demo", starting_balance: 1 });
    await importBackup(other, backup, "replace");
    expect((await other.getAll<Account>("accounts")).map((a) => a.name)).toEqual(["Main"]);
  });
  it("restores previous data if the write fails midway", async () => {
    const { store } = await seeded();
    const backup = parseBackup(JSON.stringify(await buildBackup(store)));
    const target = new MemoryStore();
    await new Repo(target).handle("POST", "/accounts", { name: "Keep me", type: "demo", starting_balance: 1 });
    const realPut = target.putMany.bind(target);
    let calls = 0;
    target.putMany = async (t, v) => { if (++calls === 2) throw new Error("disk full"); return realPut(t, v); };
    await expect(importBackup(target, backup, "replace")).rejects.toThrow(/previous data was restored/);
    target.putMany = realPut;
    expect((await target.getAll<Account>("accounts")).map((a) => a.name)).toEqual(["Keep me"]);
  });
});

describe("validation", () => {
  const good = { format: "trading-journal-backup", version: 1, exported_at: "", data: {} };
  it("rejects garbage, wrong files and newer versions with clear messages", () => {
    expect(() => parseBackup("not json")).toThrow(/valid JSON/);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow(/Trading Journal backup/);
    expect(() => parseBackup(JSON.stringify({ ...good, version: 99 }))).toThrow(/newer version/);
    expect(() => parseBackup(JSON.stringify({ ...good, data: { trades: "x" } }))).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ ...good, data: { accounts: [{ name: "no id" }] } }))).toThrow(/missing an id/);
    expect(() => parseBackup(JSON.stringify({ ...good, data: { trades: [{ id: "1", account_id: "a", direction: "long", entry_time: "garbage" }] } }))).toThrow(/invalid date/);
  });
  it("accepts an empty backup", () => {
    expect(parseBackup(JSON.stringify(good)).data.trades).toEqual([]);
  });
  it("drops records whose account is missing and reports it", async () => {
    const backup = parseBackup(JSON.stringify({
      ...good,
      data: { trades: [{ id: "t", account_id: "ghost", direction: "long", entry_time: "2026-07-28T08:00:00Z", entry_price: 1, lot_size: 1, pair: "X" }] },
    }));
    const r = await importBackup(new MemoryStore(), backup, "merge");
    expect(r.dropped).toBe(1);
  });
  it("fills defaults for older/leaner records", () => {
    const b = parseBackup(JSON.stringify({
      ...good,
      data: {
        accounts: [{ id: "a", name: "A", type: "demo", starting_balance: "100" }],
        trades: [{ id: "t", account_id: "a", pair: "EUR/USD", direction: "long", entry_price: "1.1", exit_price: "1.2", lot_size: "1", entry_time: "2026-07-28T08:00:00Z", exit_time: "2026-07-28T09:00:00Z" }],
      },
    }));
    expect(b.data.accounts[0].starting_balance).toBe(100);
    expect(b.data.accounts[0].currency).toBe("USD");
    const t = b.data.trades[0];
    expect([t.status, t.entry_price, t.tags, t.asset_class, t.conversion_rate, t.session]).toEqual(["closed", 1.1, [], "forex", null, "london"]);
  });
});
