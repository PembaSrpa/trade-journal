#!/usr/bin/env node
/**
 * One-time export of your OLD Supabase-backed journal into the new offline
 * app's backup format. Run it once, then use Settings -> Import backup.
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node tools/migrate-from-supabase.mjs [--user <auth-user-uuid>] [--out my-journal.json]
 *
 * Needs Node 18+. No dependencies. The service key stays on your machine —
 * it's only used to read your own tables and screenshots from Supabase.
 * Use --user if the project contains more than one user's data.
 */
import { writeFile } from "node:fs/promises";

const URL_ = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY;
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const userId = flag("--user");
const outFile = flag("--out") ?? "trading-journal-backup.json";

if (!URL_ || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY (the service_role key) first.");
  process.exit(1);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function fetchAll(table, query = "") {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await fetch(`${URL_}/rest/v1/${table}?select=*${query}`, {
      headers: { ...headers, Range: `${from}-${from + page - 1}`, "Range-Unit": "items" },
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}
const inList = (ids) => `&${"IDS"}=in.(${ids.join(",")})`;
async function fetchWhereIn(table, column, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    out.push(...(await fetchAll(table, `&${column}=in.(${ids.slice(i, i + 100).join(",")})`)));
  }
  return out;
}

async function downloadScreenshot(path) {
  const clean = path.replace(/^\/+/, "").replace(/^screenshots\//, "");
  const res = await fetch(`${URL_}/storage/v1/object/screenshots/${clean.split("/").map(encodeURIComponent).join("/")}`, { headers });
  if (!res.ok) return null;
  const mime = res.headers.get("content-type") ?? "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

console.log("Reading accounts...");
const accounts = await fetchAll("accounts", userId ? `&user_id=eq.${userId}` : "");
const accountIds = accounts.map((a) => a.id);
if (!accountIds.length) {
  console.error("No accounts found" + (userId ? " for that user." : "."));
  process.exit(1);
}

console.log("Reading trades and related data...");
const trades = await fetchWhereIn("trades", "account_id", accountIds);
const tradeIds = trades.map((t) => t.id);
const [transactions, notebook, playbooks, tags, shots] = await Promise.all([
  fetchWhereIn("account_transactions", "account_id", accountIds),
  fetchWhereIn("notebook_entries", "account_id", accountIds),
  fetchWhereIn("playbooks", "account_id", accountIds),
  tradeIds.length ? fetchWhereIn("trade_tags", "trade_id", tradeIds) : [],
  tradeIds.length ? fetchWhereIn("trade_screenshots", "trade_id", tradeIds) : [],
]);
const rules = playbooks.length ? await fetchWhereIn("playbook_rules", "playbook_id", playbooks.map((p) => p.id)) : [];

const tagsByTrade = new Map();
for (const t of tags) tagsByTrade.set(t.trade_id, [...(tagsByTrade.get(t.trade_id) ?? []), t.tag]);

console.log(`Downloading ${shots.length} screenshot(s)...`);
const screenshots = [];
const shotByTrade = new Map();
let missing = 0;
for (const s of shots) {
  const data_url = await downloadScreenshot(s.url);
  if (!data_url) { missing++; continue; }
  const id = `shot-${s.trade_id}`;
  screenshots.push({ id, trade_id: s.trade_id, data_url });
  shotByTrade.set(s.trade_id, id);
}

const backup = {
  format: "trading-journal-backup",
  version: 1,
  exported_at: new Date().toISOString(),
  data: {
    accounts: accounts.map(({ user_id, ...a }) => a),
    transactions,
    // `session` is dropped on purpose: the new app recomputes it from real market hours.
    trades: trades.map(({ session, ...t }) => ({
      ...t,
      tags: tagsByTrade.get(t.id) ?? [],
      screenshot_url: shotByTrade.get(t.id) ?? null,
    })),
    notebook,
    playbooks: playbooks.map((p) => ({
      ...p,
      rules: rules.filter((r) => r.playbook_id === p.id).sort((a, b) => a.sort_order - b.sort_order),
    })),
    screenshots,
  },
};

await writeFile(outFile, JSON.stringify(backup));
const d = backup.data;
console.log(
  `\nWrote ${outFile}: ${d.accounts.length} accounts, ${d.trades.length} trades, ${d.playbooks.length} playbooks, ` +
    `${d.notebook.length} notebook entries, ${d.transactions.length} transactions, ${d.screenshots.length} screenshots` +
    (missing ? ` (${missing} screenshot(s) couldn't be downloaded)` : "") +
    `.\nIn the app: Settings -> Backup & privacy -> Import backup.`
);
