import { Preferences } from "@capacitor/preferences";

const CACHE_PREFIX = "cache:";

export interface CacheEnvelope<T> {
  data: T;
  cachedAt: string;
}

export async function readCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const result = await Preferences.get({ key: CACHE_PREFIX + key });
    if (!result.value) return null;
    return JSON.parse(result.value) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  const envelope: CacheEnvelope<T> = { data, cachedAt: new Date().toISOString() };
  try {
    await Preferences.set({ key: CACHE_PREFIX + key, value: JSON.stringify(envelope) });
  } catch {
    return;
  }
}

export async function clearCache(key: string): Promise<void> {
  try {
    await Preferences.remove({ key: CACHE_PREFIX + key });
  } catch {
    return;
  }
}
