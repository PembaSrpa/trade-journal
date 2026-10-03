import { useCallback, useEffect, useRef, useState } from "react";

export type SyncStatus = "initial" | "cached" | "revalidating" | "live" | "error";

interface UseCachedFetchResult<T> {
  data: T | null;
  status: SyncStatus;
  cachedAt: string | null;
  refetch: () => void;
}

/**
 * Loads data from the on-device repository. Kept under its old name/shape so
 * pages don't change; there is no network cache any more — reads are local.
 * `cacheKey` is only used as an on/off switch (null = don't fetch yet).
 */
export function useCachedFetch<T>(
  cacheKey: string | null,
  fetcher: () => Promise<T>,
  deps: unknown[]
): UseCachedFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<SyncStatus>("initial");
  const requestIdRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    if (!cacheKey) return;
    const requestId = ++requestIdRef.current;
    try {
      const fresh = await fetcherRef.current();
      if (requestId !== requestIdRef.current) return;
      setData(fresh);
      setStatus("live");
    } catch {
      if (requestId !== requestIdRef.current) return;
      setStatus("error");
    }
  }, [cacheKey]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, status, cachedAt: null, refetch: run };
}
