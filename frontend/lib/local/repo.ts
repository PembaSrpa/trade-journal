import type {
  Account, AccountTransaction, EmotionalState, ExitType, NotebookEntry, Playbook, Stats, StoredTrade, Trade,
} from "../types";
import { calcSession } from "../core/calculations";
import { computeStats, enrichTrade, revengeFlagsByAccount } from "../core/analytics";
import { CachedStore, type Store } from "./store";
import { newId, nowIso } from "./id";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const notFound = (what: string) => new ApiError(404, `${what} not found`);
const bad = (msg: string) => new ApiError(400, msg);

const DIRECTIONS = ["long", "short"];
const LOT_UNITS = ["standard", "mini", "micro", "units"];
const ASSET_CLASSES = ["forex", "index", "stock", "crypto", "commodity"];
const EXIT_TYPES = ["tp_hit", "sl_hit", "trailed_out", "manual_close"];
const EMOTIONS = ["confident", "calm", "disciplined", "fomo", "greedy", "anxious", "hesitant", "revenge", "bored"];

const iso = (v: unknown, field: string): string => {
  const ms = Date.parse(String(v));
  if (Number.isNaN(ms)) throw bad(`Invalid ${field}`);
  return new Date(ms).toISOString();
};
const num = (v: unknown, field: string): number => {
  const n = Number(v);
  if (v === null || v === "" || !Number.isFinite(n)) throw bad(`Invalid ${field}`);
  return n;
};
const optNum = (v: unknown, field: string): number | null =>
  v === null || v === undefined || v === "" ? null : num(v, field);
const oneOf = <T extends string>(v: unknown, allowed: string[], field: string): T => {
  if (!allowed.includes(v as string)) throw bad(`Invalid ${field}`);
  return v as T;
};

/** Fields a PATCH may touch, with their validators. Presence of the key (even if null) means "set it". */
const UPDATERS: Record<string, (v: unknown) => unknown> = {
  pair: (v) => String(v),
  asset_class: (v) => oneOf(v, ASSET_CLASSES, "asset_class"),
  direction: (v) => oneOf(v, DIRECTIONS, "direction"),
  entry_price: (v) => num(v, "entry_price"),
  exit_price: (v) => optNum(v, "exit_price"),
  initial_sl: (v) => optNum(v, "initial_sl"),
  tp: (v) => optNum(v, "tp"),
  lot_size: (v) => num(v, "lot_size"),
  lot_unit: (v) => oneOf(v, LOT_UNITS, "lot_unit"),
  commission: (v) => optNum(v, "commission") ?? 0,
  swap: (v) => optNum(v, "swap") ?? 0,
  risk_percent: (v) => optNum(v, "risk_percent"),
  conversion_rate: (v) => optNum(v, "conversion_rate"),
  entry_time: (v) => iso(v, "entry_time"),
  exit_time: (v) => (v === null ? null : iso(v, "exit_time")),
  exit_type: (v) => (v === null ? null : oneOf(v, EXIT_TYPES, "exit_type")),
  setup_tag: (v) => (v === null || v === "" ? null : String(v)),
  lesson: (v) => (v === null ? null : String(v)),
  reasoning: (v) => (v === null ? null : String(v)),
  followed_plan: (v) => Boolean(v),
  status: (v) => oneOf(v, ["open", "closed"], "status"),
  playbook_id: (v) => (v === null || v === "" ? null : String(v)),
  rule_checks: (v) => (v && typeof v === "object" ? (v as Record<string, boolean>) : {}),
  emotional_state: (v) => (v === null ? null : oneOf(v, EMOTIONS, "emotional_state")),
  confidence_score: (v) => {
    if (v === null || v === undefined) return null;
    const n = num(v, "confidence_score");
    if (n < 1 || n > 5) throw bad("confidence_score must be 1-5");
    return Math.round(n);
  },
};

type Body = Record<string, unknown>;

export class Repo {
  private store: CachedStore;
  private statsCache = new Map<string, { version: number; value: Stats }>();

  constructor(store: Store) {
    this.store = store instanceof CachedStore ? store : new CachedStore(store);
  }

  /** Same shape as the old HTTP client, so UI call sites stay unchanged. */
  async handle<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
    const url = new URL(path, "http://local");
    const parts = url.pathname.split("/").filter(Boolean);
    const q = url.searchParams;
    const b = (body ?? {}) as Body;
    const [root, a1, a2] = parts;

    const result = await (async (): Promise<unknown> => {
      switch (root) {
        case "accounts":
          if (method === "GET" && !a1) return this.listAccounts(q.get("include_archived") === "true");
          if (method === "POST" && !a1) return this.createAccount(b);
          if (method === "PATCH" && a2 === "archive") return this.archiveAccount(a1);
          if (method === "DELETE" && a1) return this.deleteAccount(a1);
          break;
        case "trades":
          if (method === "GET" && !a1) return this.listTrades(q);
          if (method === "POST" && !a1) return this.createTrade(b);
          if (method === "GET" && a1) return this.getTrade(a1);
          if (method === "PATCH" && a1) return this.updateTrade(a1, b);
          if (method === "DELETE" && a1) return this.deleteTrade(a1);
          break;
        case "stats":
          if (method === "GET") return this.stats(q);
          break;
        case "playbooks":
          if (method === "GET" && !a1) return this.listPlaybooks(q.get("account_id"), q.get("include_archived") === "true");
          if (method === "POST" && !a1) return this.createPlaybook(b);
          if (method === "PATCH" && a2 === "archive") return this.archivePlaybook(a1);
          break;
        case "notebook":
          if (method === "GET" && a1 === "by-date") return this.notebookByDate(q.get("account_id"), q.get("entry_date"));
          if (method === "GET" && !a1) return this.listNotebook(q.get("account_id"));
          if (method === "POST" && !a1) return this.upsertNotebook(b);
          if (method === "DELETE" && a1) return this.deleteNotebook(a1);
          break;
        case "news":
          if (method === "GET") return this.news(q);
          break;
        case "export":
          if (method === "GET") return this.exportCsv(q);
          break;
      }
      throw new ApiError(404, `No route for ${method} ${url.pathname}`);
    })();
    return result as T;
  }

  // ---------------------------------------------------------------- accounts

  private async requireAccount(id: string | null): Promise<Account> {
    const acc = id ? await this.store.get<Account>("accounts", id) : undefined;
    if (!acc) throw notFound("Account");
    return acc;
  }

  private async listAccounts(includeArchived: boolean): Promise<Account[]> {
    const all = await this.store.getAll<Account>("accounts");
    return all
      .filter((a) => includeArchived || !a.is_archived)
      .sort((x, y) => x.created_at.localeCompare(y.created_at));
  }

  private async createAccount(b: Body): Promise<Account> {
    const name = String(b.name ?? "").trim();
    if (!name) throw bad("Account name is required");
    const acc: Account = {
      id: newId(),
      name,
      type: oneOf(b.type, ["demo", "live"], "type"),
      currency: String(b.currency ?? "USD").toUpperCase(),
      starting_balance: num(b.starting_balance, "starting_balance"),
      broker_name: (b.broker_name as string) || null,
      leverage: (b.leverage as string) || null,
      broker_timezone_offset: Number(b.broker_timezone_offset ?? 0) || 0,
      is_archived: false,
      created_at: nowIso(),
    };
    await this.store.putMany("accounts", [acc]);
    return acc;
  }

  private async archiveAccount(id: string): Promise<Account> {
    const acc = { ...(await this.requireAccount(id)), is_archived: true };
    await this.store.putMany("accounts", [acc]);
    return acc;
  }

  private async deleteAccount(id: string) {
    await this.requireAccount(id);
    const [trades, playbooks, notebook, tx] = await Promise.all([
      this.store.getAll<StoredTrade>("trades"),
      this.store.getAll<Playbook>("playbooks"),
      this.store.getAll<NotebookEntry>("notebook"),
      this.store.getAll<AccountTransaction>("transactions"),
    ]);
    const mine = trades.filter((t) => t.account_id === id);
    await this.store.deleteMany("screenshots", mine.map((t) => t.screenshot_url).filter((s): s is string => !!s));
    await this.store.deleteMany("trades", mine.map((t) => t.id));
    await this.store.deleteMany("playbooks", playbooks.filter((p) => p.account_id === id).map((p) => p.id));
    await this.store.deleteMany("notebook", notebook.filter((n) => n.account_id === id).map((n) => n.id));
    await this.store.deleteMany("transactions", tx.filter((x) => x.account_id === id).map((x) => x.id));
    await this.store.deleteMany("accounts", [id]);
    return { deleted: true };
  }

  // ------------------------------------------------------------------ trades

  private revengeCache: { version: number; flags: Map<string, boolean> } | null = null;

  private async revengeFlags(): Promise<Map<string, boolean>> {
    if (this.revengeCache?.version === this.store.version) return this.revengeCache.flags;
    const [trades, accounts] = await Promise.all([
      this.store.getAll<StoredTrade>("trades"),
      this.store.getAll<Account>("accounts"),
    ]);
    const flags = revengeFlagsByAccount(trades, accounts);
    this.revengeCache = { version: this.store.version, flags };
    return flags;
  }

  private async enrich(t: StoredTrade, account?: Account): Promise<Trade> {
    const acc = account ?? (await this.store.get<Account>("accounts", t.account_id));
    const flags = await this.revengeFlags();
    return enrichTrade(t, acc, flags.get(t.id) ?? false);
  }

  private async listTrades(q: URLSearchParams): Promise<Trade[]> {
    const account = await this.requireAccount(q.get("account_id"));
    const status = q.get("status");
    const from = q.get("from") ? Date.parse(q.get("from")!) : -Infinity;
    const to = q.get("to") ? Date.parse(q.get("to")!) : Infinity;
    const desc = (q.get("sort") ?? "desc") === "desc";
    const page = Math.max(1, Number(q.get("page") ?? 1));
    const pageSize = Math.max(1, Number(q.get("page_size") ?? 10));

    const all = (await this.store.getAll<StoredTrade>("trades")).filter((t) => t.account_id === account.id);
    const rows = all
      .filter((t) => !status || t.status === status)
      .filter((t) => {
        const ms = Date.parse(t.entry_time);
        return ms >= from && ms <= to;
      })
      .sort((x, y) => (desc ? -1 : 1) * (Date.parse(x.entry_time) - Date.parse(y.entry_time)))
      .slice((page - 1) * pageSize, page * pageSize);

    const flags = await this.revengeFlags();
    return rows.map((t) => enrichTrade(t, account, flags.get(t.id) ?? false));
  }

  private async getTrade(id: string): Promise<Trade> {
    const t = await this.store.get<StoredTrade>("trades", id);
    if (!t) throw notFound("Trade");
    return this.enrich(t);
  }

  private async createTrade(b: Body): Promise<Trade> {
    const account = await this.requireAccount(b.account_id as string);
    const exitTime = b.exit_time ? iso(b.exit_time, "exit_time") : null;
    const entryTime = iso(b.entry_time, "entry_time");
    const now = nowIso();

    const exitPrice = optNum(b.exit_price, "exit_price");
    const trade: StoredTrade = {
      id: (b.id as string) || newId(),
      account_id: account.id,
      pair: String(b.pair ?? "").trim(),
      asset_class: oneOf(b.asset_class ?? "forex", ASSET_CLASSES, "asset_class"),
      direction: oneOf(b.direction, DIRECTIONS, "direction"),
      status: exitTime ? "closed" : "open",
      entry_price: num(b.entry_price, "entry_price"),
      exit_price: exitPrice,
      initial_sl: optNum(b.initial_sl, "initial_sl"),
      tp: optNum(b.tp, "tp"),
      lot_size: num(b.lot_size, "lot_size"),
      lot_unit: oneOf(b.lot_unit ?? "standard", LOT_UNITS, "lot_unit"),
      commission: optNum(b.commission, "commission") ?? 0,
      swap: optNum(b.swap, "swap") ?? 0,
      risk_percent: optNum(b.risk_percent, "risk_percent"),
      conversion_rate: optNum(b.conversion_rate, "conversion_rate"),
      entry_time: entryTime,
      exit_time: exitTime,
      session: calcSession(entryTime),
      setup_tag: (b.setup_tag as string) || null,
      exit_type: b.exit_type ? oneOf<ExitType>(b.exit_type, EXIT_TYPES, "exit_type") : null,
      followed_plan: b.followed_plan === undefined ? true : Boolean(b.followed_plan),
      reasoning: (b.reasoning as string) || null,
      lesson: (b.lesson as string) || null,
      screenshot_url: (b.screenshot_url as string) || null,
      tags: Array.isArray(b.tags) ? (b.tags as unknown[]).map(String) : [],
      playbook_id: (b.playbook_id as string) || null,
      rule_checks: (b.rule_checks as Record<string, boolean>) ?? {},
      emotional_state: b.emotional_state ? oneOf<EmotionalState>(b.emotional_state, EMOTIONS, "emotional_state") : null,
      confidence_score: UPDATERS.confidence_score(b.confidence_score) as number | null,
      created_at: now,
      updated_at: now,
    };
    if (trade.status === "closed" && trade.exit_price === null) {
      throw bad("A closed trade needs an exit price");
    }
    await this.assertPlaybook(trade.playbook_id, account.id);
    await this.linkScreenshot(trade.screenshot_url, trade.id);
    await this.store.putMany("trades", [trade]);
    return this.enrich(trade, account);
  }

  private async assertPlaybook(playbookId: string | null, accountId: string) {
    if (!playbookId) return;
    const pb = await this.store.get<Playbook>("playbooks", playbookId);
    if (!pb || pb.account_id !== accountId) throw bad("Playbook does not belong to this account");
  }

  private async linkScreenshot(screenshotId: string | null, tradeId: string) {
    if (!screenshotId) return;
    const s = await this.store.get<{ id: string; trade_id: string | null; data_url: string }>("screenshots", screenshotId);
    if (s && s.trade_id !== tradeId) await this.store.putMany("screenshots", [{ ...s, trade_id: tradeId }]);
  }

  private async updateTrade(id: string, b: Body): Promise<Trade> {
    const existing = await this.store.get<StoredTrade>("trades", id);
    if (!existing) throw notFound("Trade");
    const account = await this.requireAccount(existing.account_id);

    const next: StoredTrade = { ...existing };
    for (const key of Object.keys(UPDATERS)) {
      if (key in b) (next as unknown as Body)[key] = UPDATERS[key](b[key]);
    }

    if ("entry_time" in b) next.session = calcSession(next.entry_time);

    if ("exit_price" in b) {
      if (next.exit_price === null) {
        // Clearing the exit price reopens the trade (fix #7).
        next.status = "open";
        next.exit_time = null;
        next.exit_type = null;
      } else if (!("status" in b)) {
        next.status = "closed";
        next.exit_time = next.exit_time ?? nowIso();
      }
    }
    if (next.status === "closed" && next.exit_price === null) throw bad("A closed trade needs an exit price");
    if (next.status === "open") {
      next.exit_time = null;
    }

    if ("tags" in b) next.tags = Array.isArray(b.tags) ? (b.tags as unknown[]).map(String) : [];
    if ("playbook_id" in b) await this.assertPlaybook(next.playbook_id, account.id);

    if ("screenshot_url" in b) {
      const incoming = (b.screenshot_url as string) || null;
      if (existing.screenshot_url && existing.screenshot_url !== incoming) {
        await this.store.deleteMany("screenshots", [existing.screenshot_url]);
      }
      next.screenshot_url = incoming;
      await this.linkScreenshot(incoming, id);
    }

    next.updated_at = nowIso();
    await this.store.putMany("trades", [next]);
    return this.enrich(next, account);
  }

  private async deleteTrade(id: string) {
    const t = await this.store.get<StoredTrade>("trades", id);
    if (!t) throw notFound("Trade");
    if (t.screenshot_url) await this.store.deleteMany("screenshots", [t.screenshot_url]);
    await this.store.deleteMany("trades", [id]);
    return { deleted: true };
  }

  // ------------------------------------------------------------------- stats

  private async stats(q: URLSearchParams): Promise<Stats> {
    const accountId = q.get("account_id");
    const type = q.get("account_type");
    if (!accountId && !type) throw bad("account_id or account_type is required");

    const key = q.toString();
    const hit = this.statsCache.get(key);
    if (hit && hit.version === this.store.version) return hit.value;

    const all = (await this.store.getAll<Account>("accounts")).filter((a) => !a.is_archived);
    const accounts = accountId ? all.filter((a) => a.id === accountId) : all.filter((a) => a.type === type);
    if (!accounts.length) throw notFound("Matching accounts");

    const [trades, transactions] = await Promise.all([
      this.store.getAll<StoredTrade>("trades"),
      this.store.getAll<AccountTransaction>("transactions"),
    ]);
    const value = computeStats({
      accounts,
      trades,
      transactions,
      from: q.get("from_date") ?? q.get("from") ?? undefined,
      to: q.get("to_date") ?? q.get("to") ?? undefined,
    });
    this.statsCache.set(key, { version: this.store.version, value });
    return value;
  }

  // --------------------------------------------------------------- playbooks

  private async listPlaybooks(accountId: string | null, includeArchived: boolean): Promise<Playbook[]> {
    await this.requireAccount(accountId);
    return (await this.store.getAll<Playbook>("playbooks"))
      .filter((p) => p.account_id === accountId && (includeArchived || !p.is_archived))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((p) => ({ ...p, rules: [...p.rules].sort((x, y) => x.sort_order - y.sort_order) }));
  }

  private async createPlaybook(b: Body): Promise<Playbook> {
    const account = await this.requireAccount(b.account_id as string);
    const name = String(b.name ?? "").trim();
    if (!name) throw bad("Playbook name is required");
    const id = newId();
    const rules = ((b.rules as { rule_text: string; sort_order?: number }[]) ?? []).map((r, i) => ({
      id: newId(),
      playbook_id: id,
      rule_text: String(r.rule_text),
      sort_order: r.sort_order ?? i,
    }));
    const pb: Playbook = { id, account_id: account.id, name, is_archived: false, created_at: nowIso(), rules };
    await this.store.putMany("playbooks", [pb]);
    return pb;
  }

  private async archivePlaybook(id: string): Promise<Playbook> {
    const pb = await this.store.get<Playbook>("playbooks", id);
    if (!pb) throw notFound("Playbook");
    const next = { ...pb, is_archived: true };
    await this.store.putMany("playbooks", [next]);
    return next;
  }

  // ---------------------------------------------------------------- notebook

  private async listNotebook(accountId: string | null): Promise<NotebookEntry[]> {
    await this.requireAccount(accountId);
    return (await this.store.getAll<NotebookEntry>("notebook"))
      .filter((n) => n.account_id === accountId)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  }

  private async notebookByDate(accountId: string | null, date: string | null): Promise<NotebookEntry | null> {
    await this.requireAccount(accountId);
    return (await this.store.getAll<NotebookEntry>("notebook")).find(
      (n) => n.account_id === accountId && n.entry_date === date
    ) ?? null;
  }

  private async upsertNotebook(b: Body): Promise<NotebookEntry> {
    const account = await this.requireAccount(b.account_id as string);
    const date = String(b.entry_date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad("entry_date must be YYYY-MM-DD");
    const existing = (await this.store.getAll<NotebookEntry>("notebook")).find(
      (n) => n.account_id === account.id && n.entry_date === date
    );
    const now = nowIso();
    const entry: NotebookEntry = existing
      ? { ...existing, content: String(b.content ?? ""), updated_at: now }
      : { id: newId(), account_id: account.id, entry_date: date, content: String(b.content ?? ""), created_at: now, updated_at: now };
    await this.store.putMany("notebook", [entry]);
    return entry;
  }

  private async deleteNotebook(id: string) {
    await this.store.deleteMany("notebook", [id]);
    return { deleted: true };
  }

  // ------------------------------------------------------------------ export

  /** Returns CSV text. Honors the optional from/to range (the old server export silently ignored it). */
  private async exportCsv(q: URLSearchParams): Promise<{ text: string; mime: string }> {
    const trades = await this.listTrades(
      new URLSearchParams({ account_id: q.get("account_id") ?? "", sort: "asc", page: "1", page_size: "1000000",
        ...(q.get("from") ? { from: q.get("from")! } : {}), ...(q.get("to") ? { to: q.get("to")! } : {}) })
    );
    const cols: [string, (t: Trade) => unknown][] = [
      ["Entry time", (t) => t.entry_time], ["Pair", (t) => t.pair], ["Direction", (t) => t.direction],
      ["Entry", (t) => t.entry_price], ["Exit", (t) => t.exit_price], ["SL", (t) => t.initial_sl],
      ["TP", (t) => t.tp], ["Lot size", (t) => t.lot_size], ["Pips", (t) => t.pips], ["P/L", (t) => t.pnl],
      ["R multiple", (t) => t.r_multiple], ["Session", (t) => t.session], ["Setup", (t) => t.setup_tag],
      ["Exit type", (t) => t.exit_type], ["Followed plan", (t) => t.followed_plan],
    ];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.map(([h]) => h).join(",")];
    for (const t of trades) lines.push(cols.map(([, f]) => esc(f(t))).join(","));
    return { text: lines.join("\n"), mime: "text/csv" };
  }

  // -------------------------------------------------------------------- news

  private newsCache = new Map<string, { at: number; articles: unknown[] }>();

  /** Optional online-only feature: uses a Finnhub key the user pastes into Settings. Never required by the app. */
  private async news(q: URLSearchParams): Promise<unknown[]> {
    const key = (await this.store.get<{ id: string; value: string }>("meta", "finnhub_key"))?.value;
    if (!key) throw new ApiError(400, "NO_KEY");
    const category = q.get("category") ?? "forex";
    const hit = this.newsCache.get(category);
    let articles: unknown[];
    if (hit && Date.now() - hit.at < 15 * 60_000) {
      articles = hit.articles;
    } else {
      if (typeof navigator !== "undefined" && navigator.onLine === false) throw new ApiError(503, "OFFLINE");
      let res: Response;
      try {
        res = await fetch(`https://finnhub.io/api/v1/news?category=${encodeURIComponent(category)}&token=${encodeURIComponent(key)}`);
      } catch {
        throw new ApiError(503, "OFFLINE");
      }
      if (!res.ok) throw new ApiError(res.status, res.status === 401 || res.status === 403 ? "BAD_KEY" : "NEWS_ERROR");
      articles = (await res.json()) as unknown[];
      this.newsCache.set(category, { at: Date.now(), articles });
    }
    const pair = q.get("pair");
    if (pair) {
      const [base, quote] = pair.toUpperCase().split("/");
      articles = (articles as { headline?: string }[]).filter((a) => {
        const h = (a.headline ?? "").toUpperCase();
        return h.includes(base) || (!!quote && h.includes(quote));
      });
    }
    return articles.slice(0, 20);
  }

  // ------------------------------------------------------- backup / settings

  /** Raw access for the backup module. */
  get raw(): CachedStore {
    return this.store;
  }
}
