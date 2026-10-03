import type {
  Account, AccountTransaction, NotebookEntry, Playbook, StoredTrade,
} from "../types";
import { calcSession } from "../core/calculations";
import { TABLES, type Store, type TableName } from "./store";

export const BACKUP_FORMAT = "trading-journal-backup";
export const BACKUP_VERSION = 1;

export interface ScreenshotRecord {
  id: string;
  trade_id: string | null;
  /** The image itself as a data: URL, so the backup is one self-contained file. */
  data_url: string;
}

export interface BackupData {
  accounts: Account[];
  trades: StoredTrade[];
  playbooks: Playbook[];
  notebook: NotebookEntry[];
  transactions: AccountTransaction[];
  screenshots: ScreenshotRecord[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exported_at: string;
  data: BackupData;
}

/** Tables that make up user data (everything except app settings in `meta`). */
const DATA_TABLES: (keyof BackupData)[] = [
  "accounts", "trades", "playbooks", "notebook", "transactions", "screenshots",
];

export class BackupError extends Error {}

export async function buildBackup(store: Store): Promise<BackupFile> {
  const data = {} as BackupData;
  for (const t of DATA_TABLES) {
    (data as unknown as Record<string, unknown>)[t] = await store.getAll(t as TableName);
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exported_at: new Date().toISOString(), data };
}

export function backupFilename(date = new Date()): string {
  return `trading-journal-backup-${date.toISOString().slice(0, 10)}.json`;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function arr(data: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const v = data[key];
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new BackupError(`"${key}" must be a list`);
  v.forEach((row, i) => {
    if (!isObj(row) || typeof row.id !== "string" || !row.id) {
      throw new BackupError(`"${key}" entry ${i + 1} is missing an id`);
    }
  });
  return v as Record<string, unknown>[];
}

const num = (v: unknown, d: number | null = null): number | null =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v);

function normalizeTrade(r: Record<string, unknown>): StoredTrade {
  const entry = new Date(String(r.entry_time)).toISOString(); // throws on garbage -> caught by caller
  const exit = r.exit_time ? new Date(String(r.exit_time)).toISOString() : null;
  const exitPrice = num(r.exit_price);
  const created = r.created_at ? new Date(String(r.created_at)).toISOString() : entry;
  return {
    id: r.id as string,
    account_id: String(r.account_id),
    pair: String(r.pair ?? ""),
    asset_class: (r.asset_class as StoredTrade["asset_class"]) ?? "forex",
    direction: r.direction as StoredTrade["direction"],
    status: exit && exitPrice !== null ? "closed" : "open",
    entry_price: num(r.entry_price, 0) as number,
    exit_price: exitPrice,
    initial_sl: num(r.initial_sl),
    tp: num(r.tp),
    lot_size: num(r.lot_size, 0) as number,
    lot_unit: (r.lot_unit as StoredTrade["lot_unit"]) ?? "standard",
    commission: num(r.commission, 0) as number,
    swap: num(r.swap, 0) as number,
    risk_percent: num(r.risk_percent),
    conversion_rate: num(r.conversion_rate),
    entry_time: entry,
    exit_time: exit,
    session: (r.session as string) ?? calcSession(entry),
    setup_tag: (r.setup_tag as string) ?? null,
    exit_type: (r.exit_type as StoredTrade["exit_type"]) ?? null,
    followed_plan: r.followed_plan === undefined ? true : Boolean(r.followed_plan),
    reasoning: (r.reasoning as string) ?? null,
    lesson: (r.lesson as string) ?? null,
    screenshot_url: (r.screenshot_url as string) ?? null,
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    playbook_id: (r.playbook_id as string) ?? null,
    rule_checks: isObj(r.rule_checks) ? (r.rule_checks as Record<string, boolean>) : {},
    emotional_state: (r.emotional_state as StoredTrade["emotional_state"]) ?? null,
    confidence_score: num(r.confidence_score),
    created_at: created,
    updated_at: r.updated_at ? new Date(String(r.updated_at)).toISOString() : created,
  };
}

/** Parses and validates a backup file's text. Never touches the store. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("This file isn't valid JSON.");
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) {
    throw new BackupError("This doesn't look like a Trading Journal backup file.");
  }
  if (typeof raw.version !== "number" || raw.version > BACKUP_VERSION) {
    throw new BackupError(
      `This backup was made by a newer version of the app (format v${String(raw.version)}). Update the app and try again.`
    );
  }
  if (!isObj(raw.data)) throw new BackupError("The backup has no data section.");
  const d = raw.data;

  const accounts = arr(d, "accounts") as unknown as Account[];
  for (const a of accounts) {
    if (!a.name || !["demo", "live"].includes(a.type)) throw new BackupError(`Account "${a.id}" is malformed.`);
  }
  let trades: StoredTrade[];
  try {
    trades = arr(d, "trades").map(normalizeTrade);
  } catch (e) {
    if (e instanceof BackupError) throw e;
    throw new BackupError("A trade in the backup has an invalid date.");
  }
  for (const t of trades) {
    if (!["long", "short"].includes(t.direction)) throw new BackupError(`Trade "${t.id}" has an invalid direction.`);
  }

  return {
    format: BACKUP_FORMAT,
    version: raw.version,
    exported_at: String(raw.exported_at ?? ""),
    data: {
      accounts: accounts.map((a) => ({
        ...a,
        currency: String(a.currency ?? "USD").toUpperCase(),
        starting_balance: num(a.starting_balance, 0) as number,
        broker_name: a.broker_name ?? null,
        leverage: a.leverage ?? null,
        broker_timezone_offset: num(a.broker_timezone_offset, 0) as number,
        is_archived: Boolean(a.is_archived),
        created_at: a.created_at ?? new Date().toISOString(),
      })),
      trades,
      playbooks: (arr(d, "playbooks") as unknown as Playbook[]).map((p) => ({
        ...p,
        is_archived: Boolean(p.is_archived),
        rules: Array.isArray(p.rules) ? p.rules : [],
      })),
      notebook: arr(d, "notebook") as unknown as NotebookEntry[],
      transactions: (arr(d, "transactions") as unknown as AccountTransaction[]).map((x) => ({
        ...x,
        amount: num(x.amount, 0) as number,
      })),
      screenshots: arr(d, "screenshots") as unknown as ScreenshotRecord[],
    },
  };
}

export interface ImportReport {
  mode: "merge" | "replace";
  added: Record<keyof BackupData, number>;
  skipped: Record<keyof BackupData, number>;
  /** Records dropped because the account/trade they belong to isn't in the data. */
  dropped: number;
}

const zero = (): Record<keyof BackupData, number> => ({
  accounts: 0, trades: 0, playbooks: 0, notebook: 0, transactions: 0, screenshots: 0,
});

/**
 * Merge: records whose id already exists are left untouched, so importing the
 * same file twice (or an older backup over newer data) never duplicates or
 * overwrites anything. Replace: wipes existing data first; if writing fails
 * partway, the previous data is restored.
 */
export async function importBackup(
  store: Store,
  backup: BackupFile,
  mode: "merge" | "replace"
): Promise<ImportReport> {
  const report: ImportReport = { mode, added: zero(), skipped: zero(), dropped: 0 };
  const incoming = backup.data;

  const existing: Partial<Record<keyof BackupData, { id: string }[]>> = {};
  if (mode === "merge") {
    for (const t of DATA_TABLES) existing[t] = await store.getAll(t as TableName);
  }
  const has = (t: keyof BackupData) => new Set((existing[t] ?? []).map((r) => r.id));

  const accountIds = new Set([...(mode === "merge" ? has("accounts") : []), ...incoming.accounts.map((a) => a.id)]);
  const tradeIds = new Set([...(mode === "merge" ? has("trades") : []), ...incoming.trades.map((t) => t.id)]);

  const plan: { [K in keyof BackupData]: BackupData[K] } = {
    accounts: incoming.accounts,
    trades: incoming.trades.filter((t) => accountIds.has(t.account_id)),
    playbooks: incoming.playbooks.filter((p) => accountIds.has(p.account_id)),
    notebook: incoming.notebook.filter((n) => accountIds.has(n.account_id)),
    transactions: incoming.transactions.filter((x) => accountIds.has(x.account_id)),
    screenshots: incoming.screenshots.filter((s) => !s.trade_id || tradeIds.has(s.trade_id)),
  };
  for (const t of DATA_TABLES) report.dropped += incoming[t].length - plan[t].length;

  const toWrite: Partial<Record<keyof BackupData, { id: string }[]>> = {};
  for (const t of DATA_TABLES) {
    const rows = plan[t] as { id: string }[];
    if (mode === "merge") {
      const seen = has(t);
      const fresh = rows.filter((r) => !seen.has(r.id));
      report.skipped[t] = rows.length - fresh.length;
      toWrite[t] = fresh;
    } else {
      toWrite[t] = rows;
    }
    report.added[t] = toWrite[t]!.length;
  }

  // Notebook has one entry per account per day: in merge mode keep the existing entry.
  if (mode === "merge") {
    const taken = new Set((existing.notebook as NotebookEntry[] | undefined ?? []).map((n) => `${n.account_id}|${n.entry_date}`));
    const before = toWrite.notebook!.length;
    toWrite.notebook = (toWrite.notebook as NotebookEntry[]).filter((n) => !taken.has(`${n.account_id}|${n.entry_date}`));
    report.skipped.notebook += before - toWrite.notebook.length;
    report.added.notebook = toWrite.notebook.length;
  }

  let snapshot: Partial<Record<keyof BackupData, unknown[]>> | null = null;
  try {
    if (mode === "replace") {
      snapshot = {};
      for (const t of DATA_TABLES) snapshot[t] = await store.getAll(t as TableName);
      for (const t of DATA_TABLES) await store.clear(t as TableName);
    }
    // Parents before children.
    for (const t of ["accounts", "playbooks", "trades", "screenshots", "notebook", "transactions"] as const) {
      await store.putMany(t as TableName, toWrite[t] as { id: string }[]);
    }
  } catch (e) {
    if (snapshot) {
      for (const t of DATA_TABLES) {
        await store.clear(t as TableName);
        await store.putMany(t as TableName, snapshot[t] as { id: string }[]);
      }
    }
    throw new BackupError(`Import failed${snapshot ? " — your previous data was restored" : ""}: ${(e as Error).message}`);
  }
  return report;
}

export { TABLES };
