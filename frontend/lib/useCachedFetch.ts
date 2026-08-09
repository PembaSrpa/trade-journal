import { useCallback, useEffect, useRef, useState } from "react";
import { readCache, writeCache } from "@/lib/dataCache";

export type SyncStatus = "initial" | "cached" | "revalidating" | "live" | "error";

interface UseCachedFetchResult<T> {
  data: T | null;
  status: SyncStatus;
  cachedAt: string | null;
  refetch: () => void;
}

export function useCachedFetch<T>(
  cacheKey: string | null,
  fetcher: () => Promise<T>,
  deps: unknown[]
): UseCachedFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<SyncStatus>("initial");
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    if (!cacheKey) return;
    const requestId = ++requestIdRef.current;

    const cached = await readCache<T>(cacheKey);
    if (requestId !== requestIdRef.current) return;

    if (cached) {
      setData(cached.data);
      setCachedAt(cached.cachedAt);
      setStatus("revalidating");
    } else {
      setStatus("initial");
    }

    try {
      const fresh = await fetcherRef.current();
      if (requestId !== requestIdRef.current) return;
      setData(fresh);
      setStatus("live");
      const now = new Date().toISOString();
      setCachedAt(now);
      void writeCache(cacheKey, fresh);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setStatus(cached ? "cached" : "error");
    }
  }, [cacheKey]);

  useEffect(() => {
    run();
  }, deps);

  return { data, status, cachedAt, refetch: run };
}
