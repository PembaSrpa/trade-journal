"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Account } from "@/lib/types";

interface AccountContextValue {
  accounts: Account[];
  selectedAccountId: string | null;
  selectAccount: (id: string) => void;
  refreshAccounts: () => Promise<void>;
  loading: boolean;
  syncNonce: number;
  triggerSync: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const STORAGE_KEY = "journal_selected_account_id";

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncNonce, setSyncNonce] = useState(0);

  function triggerSync() {
    setSyncNonce((n) => n + 1);
  }

  async function refreshAccounts() {
    const data = await apiGet<Account[]>("/accounts");
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
