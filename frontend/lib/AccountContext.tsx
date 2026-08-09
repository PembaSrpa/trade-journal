"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { readCache, writeCache } from "@/lib/dataCache";
import type { SyncStatus } from "@/lib/useCachedFetch";
import type { Account } from "@/lib/types";

interface AccountContextValue {
  accounts: Account[];
  selectedAccountId: string | null;
  selectAccount: (id: string) => void;
  refreshAccounts: () => Promise<void>;
  loading: boolean;
  syncNonce: number;
  triggerSync: () => void;
  accountsStatus: SyncStatus;
  accountsCachedAt: string | null;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const STORAGE_KEY = "journal_selected_account_id";
const ACCOUNTS_CACHE_KEY = "accounts:list";

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
  );
  const [loading, setLoading] = useState(true);
  const [syncNonce, setSyncNonce] = useState(0);
  const [accountsStatus, setAccountsStatus] = useState<SyncStatus>("initial");
  const [accountsCachedAt, setAccountsCachedAt] = useState<string | null>(null);

  function triggerSync() {
    setSyncNonce((n) => n + 1);
  }

  async function applyAccounts(data: Account[]) {
    setAccounts(data);

    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const isCombined = !!stored && stored.startsWith("combined:");
    const stillValid = isCombined || data.some((a) => a.id === stored);

    if (stillValid) {
      setSelectedAccountId(stored);
    } else if (data.length > 0) {
      setSelectedAccountId(data[0].id);
      localStorage.setItem(STORAGE_KEY, data[0].id);
    } else {
      setSelectedAccountId(null);
    }
  }

  async function refreshAccounts() {
    const cached = await readCache<Account[]>(ACCOUNTS_CACHE_KEY);
    if (cached) {
      await applyAccounts(cached.data);
      setAccountsCachedAt(cached.cachedAt);
      setAccountsStatus("revalidating");
    }

    try {
      const data = await apiGet<Account[]>("/accounts");
      await applyAccounts(data);
      const now = new Date().toISOString();
      setAccountsCachedAt(now);
      setAccountsStatus("live");
      void writeCache(ACCOUNTS_CACHE_KEY, data);
    } catch {
      setAccountsStatus(cached ? "cached" : "error");
    }
  }

  useEffect(() => {
    refreshAccounts().finally(() => setLoading(false));
  }, []);

  function selectAccount(id: string) {
    setSelectedAccountId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  return (
    <AccountContext.Provider
      value={{
        accounts,
        selectedAccountId,
        selectAccount,
        refreshAccounts,
        loading,
        syncNonce,
        triggerSync,
        accountsStatus,
        accountsCachedAt,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccountContext() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccountContext must be used within AccountProvider");
  return ctx;
}
