"use client";

import { useAccountContext } from "@/lib/AccountContext";
import { Dropdown, type DropdownOption } from "@/components/Dropdown";

export function AccountSwitcher({ className }: { className?: string }) {
  const { accounts, selectedAccountId, selectAccount, loading } = useAccountContext();

  if (loading && accounts.length === 0) {
    return <div className={`h-9 rounded-lg bg-surface-2 animate-pulse ${className ?? "w-full"}`} />;
  }

  if (accounts.length === 0) {
    return (
      <a href="/settings" className="text-sm text-accent-glow">
        Create an account
      </a>
    );
  }

  const hasDemo = accounts.some((a) => a.type === "demo");
  const hasLive = accounts.some((a) => a.type === "live");

  const options: DropdownOption<string>[] = [
    ...accounts.map((account) => ({ value: account.id, label: account.name })),
    ...(hasDemo ? [{ value: "combined:demo", label: "All demo accounts" }] : []),
    ...(hasLive ? [{ value: "combined:live", label: "All funded accounts" }] : []),
  ];

  return (
    <Dropdown
      value={selectedAccountId ?? ""}
      onChange={selectAccount}
      options={options}
      className={className ?? "w-full"}
      buttonClassName="!bg-surface-2 !text-sm !py-2 !px-3"
    />
  );
}
