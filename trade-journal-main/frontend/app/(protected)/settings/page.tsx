"use client";

import { useState } from "react";
import { Archive, Trash2 } from "lucide-react";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { useAccountContext } from "@/lib/AccountContext";
import { isCombinedSelection } from "@/lib/accountSelection";
import { PlaybookManager } from "@/components/PlaybookManager";
import type { Account, AccountType } from "@/lib/types";

export default function SettingsPage() {
  const { accounts, refreshAccounts, selectedAccountId } = useAccountContext();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("demo");
  const [currency, setCurrency] = useState("USD");
  const [startingBalance, setStartingBalance] = useState("");
  const [brokerName, setBrokerName] = useState("");
  const [leverage, setLeverage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await apiPost<Account>("/accounts", {
      name,
      type,
      currency,
      starting_balance: Number(startingBalance),
      broker_name: brokerName || null,
      leverage: leverage || null,
      broker_timezone_offset: 0,
    });
    await refreshAccounts();
    setName("");
    setStartingBalance("");
    setBrokerName("");
    setLeverage("");
    setSaving(false);
  }

  async function handleArchive(id: string) {
    await apiPatch(`/accounts/${id}/archive`, {});
    await refreshAccounts();
  }

  async function handleDelete(id: string, name: string) {
    const confirmed = confirm(
      `Permanently delete "${name}"? This deletes every trade in it and cannot be undone. Archive instead if you just want it hidden.`
    );
    if (!confirmed) return;
    await apiDelete(`/accounts/${id}`);
    await refreshAccounts();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xl font-medium tracking-tight">Settings</p>
        <p className="text-xs text-text-muted mt-0.5">Accounts, playbooks, and preferences</p>
      </div>

      <div>
        <p className="text-sm text-text-secondary mb-3">Your accounts</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{account.name}</p>
                <p className="text-xs text-text-secondary">
                  {account.type} · {account.currency} · started at{" "}
                  {account.starting_balance.toLocaleString()}
                  {account.leverage ? ` · ${account.leverage}` : ""}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleArchive(account.id)}
                  title="Hide from the switcher, keep all trade history"
                  className="w-8 h-8 p-0 flex items-center justify-center"
                >
                  <Archive size={14} />
                </button>
                <button
                  onClick={() => handleDelete(account.id, account.name)}
                  title="Permanently delete this account and every trade in it"
                  className="w-8 h-8 p-0 flex items-center justify-center hover:text-danger hover:border-danger/50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {accounts.length === 0 && (
            <p className="text-text-secondary text-sm">No accounts yet.</p>
          )}
        </div>
        <p className="text-xs text-text-muted mt-2">
          Archive hides an account but keeps its history. Delete removes it and every trade in it permanently.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div>
        <p className="text-sm text-text-secondary mb-3">Add an account</p>
        <form
          onSubmit={handleCreate}
          className="bg-surface border border-border rounded-2xl p-5 space-y-3"
        >
          <div>
            <label className="block text-xs text-text-secondary mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Demo 1"
              className="w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full"
              >
                <option value="demo">Demo</option>
                <option value="live">Live</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Currency</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Starting balance
            </label>
            <input
              type="number"
              step="0.01"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              className="w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">
                Broker (optional)
              </label>
              <input
                type="text"
                value={brokerName}
                onChange={(e) => setBrokerName(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">
                Leverage (optional)
              </label>
              <input
                type="text"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                placeholder="1:100"
                className="w-full"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-accent border-accent hover:bg-accent-glow text-white font-medium"
          >
            {saving ? "Adding..." : "Add account"}
          </button>
        </form>
      </div>

      <div>
        {selectedAccountId && !isCombinedSelection(selectedAccountId) ? (
          <PlaybookManager accountId={selectedAccountId} />
        ) : (
          <div>
            <p className="text-sm text-text-secondary mb-3">Playbooks</p>
            <p className="text-text-secondary text-sm">
              Select a specific account to manage its playbooks.
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
