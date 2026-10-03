/**
 * Historical note: this was a stale-while-revalidate cache over Capacitor
 * Preferences, needed when data lived on a remote server. Data is now local
 * and instant (and already memoized in lib/local), so a second cache would only
 * risk showing stale numbers. The functions remain as harmless no-ops so
 * existing call sites keep working.
 */
export interface CacheEnvelope<T> {
  data: T;
  cachedAt: string;
}
export async function readCache<T>(_key: string): Promise<CacheEnvelope<T> | null> {
  return null;
}
export async function writeCache<T>(_key: string, _data: T): Promise<void> {}
export async function clearCache(_key: string): Promise<void> {}
export async function clearCacheByPrefix(_prefix: string): Promise<void> {}
