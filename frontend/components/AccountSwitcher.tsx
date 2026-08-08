"use client";

import { useAccountContext } from "@/lib/AccountContext";

export function AccountSwitcher() {
  const { accounts, selectedAccountId, selectAccount, loading } = useAccountContext();

  if (loading) return null;

  if (accounts.length === 0) {
    return (
      <a href="/settings" className="text-sm text-accent-glow">
        Create an account
      </a>
    );
  }

  const hasDemo = accounts.some((a) => a.type === "demo");
  const hasLive = accounts.some((a) => a.type === "live");

  return (
    <select
      value={selectedAccountId ?? ""}
      onChange={(e) => selectAccount(e.target.value)}
      className="w-full text-sm bg-surface-2"
    >
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
      {hasDemo && <option value="combined:demo">All demo accounts</option>}
      {hasLive && <option value="combined:live">All funded accounts</option>}
    </select>
  );
}
