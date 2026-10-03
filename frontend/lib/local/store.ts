/**
 * On-device persistence. One tiny key-value-per-table interface, with two
 * implementations: IndexedDB (browser + Android WebView) and an in-memory
 * one (tests, and a safe fallback if IndexedDB is unavailable).
 */

export type TableName =
  | "accounts"
  | "trades"
  | "playbooks"
  | "notebook"
  | "transactions"
  | "screenshots"
  | "meta";

export const TABLES: TableName[] = [
  "accounts", "trades", "playbooks", "notebook", "transactions", "screenshots", "meta",
];

export interface Store {
  getAll<T>(table: TableName): Promise<T[]>;
  get<T>(table: TableName, id: string): Promise<T | undefined>;
  putMany<T extends { id: string }>(table: TableName, values: T[]): Promise<void>;
  deleteMany(table: TableName, ids: string[]): Promise<void>;
  clear(table: TableName): Promise<void>;
}

export class MemoryStore implements Store {
  private data = new Map<TableName, Map<string, unknown>>();
  private t(table: TableName) {
    let m = this.data.get(table);
    if (!m) this.data.set(table, (m = new Map()));
    return m;
  }
  async getAll<T>(table: TableName) {
    return structuredClone([...this.t(table).values()]) as T[];
  }
  async get<T>(table: TableName, id: string) {
    const v = this.t(table).get(id);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }
  async putMany<T extends { id: string }>(table: TableName, values: T[]) {
    for (const v of values) this.t(table).set(v.id, structuredClone(v));
  }
  async deleteMany(table: TableName, ids: string[]) {
    for (const id of ids) this.t(table).delete(id);
  }
  async clear(table: TableName) {
    this.t(table).clear();
  }
}

const DB_NAME = "trading-journal";
const DB_VERSION = 1;

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDbStore implements Store {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const open = indexedDB.open(DB_NAME, DB_VERSION);
        open.onupgradeneeded = () => {
          const db = open.result;
          for (const t of TABLES) {
            if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: "id" });
          }
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
    }
    return this.dbPromise;
  }

  private async tx(table: TableName, mode: IDBTransactionMode) {
    const db = await this.db();
    return db.transaction(table, mode);
  }

  async getAll<T>(table: TableName) {
    const tx = await this.tx(table, "readonly");
    return reqToPromise(tx.objectStore(table).getAll()) as Promise<T[]>;
  }

  async get<T>(table: TableName, id: string) {
    const tx = await this.tx(table, "readonly");
    return (await reqToPromise(tx.objectStore(table).get(id))) as T | undefined;
  }

  async putMany<T extends { id: string }>(table: TableName, values: T[]) {
    if (!values.length) return;
    const tx = await this.tx(table, "readwrite");
    const store = tx.objectStore(table);
    for (const v of values) store.put(v);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async deleteMany(table: TableName, ids: string[]) {
    if (!ids.length) return;
    const tx = await this.tx(table, "readwrite");
    const store = tx.objectStore(table);
    for (const id of ids) store.delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(table: TableName) {
    const tx = await this.tx(table, "readwrite");
    await reqToPromise(tx.objectStore(table).clear());
  }
}

/**
 * Wraps a store with an in-memory read cache. Whole tables are read once and
 * served from memory until something writes to them, so the Overview, Journal
 * and detail pages don't each re-read everything from disk.
 */
export class CachedStore implements Store {
  private cache = new Map<TableName, unknown[]>();
  /** Bumped on every write; derived caches (stats, revenge flags) key on it. */
  version = 0;
  constructor(private inner: Store) {}

  private touch(table: TableName) {
    this.cache.delete(table);
    this.version++;
  }
  async getAll<T>(table: TableName) {
    let rows = this.cache.get(table);
    if (!rows) {
      rows = await this.inner.getAll<T>(table);
      this.cache.set(table, rows);
    }
    return rows.slice() as T[];
  }
  get<T>(table: TableName, id: string) {
    return this.inner.get<T>(table, id);
  }
  async putMany<T extends { id: string }>(table: TableName, values: T[]) {
    await this.inner.putMany(table, values);
    this.touch(table);
  }
  async deleteMany(table: TableName, ids: string[]) {
    await this.inner.deleteMany(table, ids);
    this.touch(table);
  }
  async clear(table: TableName) {
    await this.inner.clear(table);
    this.touch(table);
  }
}
