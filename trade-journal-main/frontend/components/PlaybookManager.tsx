"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Playbook } from "@/lib/types";

export function PlaybookManager({ accountId }: { accountId: string }) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [name, setName] = useState("");
  const [rules, setRules] = useState<string[]>([]);
  const [ruleInput, setRuleInput] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Playbook[]>(`/playbooks?account_id=${accountId}`).then(setPlaybooks);
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function addRule() {
    const value = ruleInput.trim();
    if (!value) return;
    setRules([...rules, value]);
    setRuleInput("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || rules.length === 0) return;
    setSaving(true);
    await apiPost("/playbooks", {
      account_id: accountId,
      name: name.trim(),
      rules: rules.map((rule_text, sort_order) => ({ rule_text, sort_order })),
    });
    setName("");
    setRules([]);
    refresh();
    setSaving(false);
  }

  async function handleArchive(id: string) {
    await apiPatch(`/playbooks/${id}/archive`, {});
    refresh();
  }

  return (
    <div>
      <p className="text-sm text-text-secondary mb-3">Playbooks</p>

      <div className="space-y-2 mb-6">
        {playbooks.map((p) => (
          <div key={p.id} className="bg-surface border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium">{p.name}</p>
              <button onClick={() => handleArchive(p.id)} className="text-xs">
                Archive
              </button>
            </div>
            <ul className="text-xs text-text-secondary space-y-1">
              {p.rules.map((r) => (
                <li key={r.id}>• {r.rule_text}</li>
              ))}
            </ul>
          </div>
        ))}
        {playbooks.length === 0 && (
          <p className="text-text-secondary text-sm">No playbooks yet.</p>
        )}
      </div>

      <form
        onSubmit={handleCreate}
        className="bg-surface border border-border rounded-2xl p-5 space-y-3"
      >
        <div>
          <label className="block text-xs text-text-secondary mb-1">Playbook name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pullback EMA breakout"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-xs text-text-secondary mb-1">Rules</label>
          <div className="space-y-1 mb-2">
            {rules.map((rule, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-bg rounded px-3 py-2 text-sm"
              >
                <span>{rule}</span>
                <button
                  type="button"
                  onClick={() => setRules(rules.filter((_, idx) => idx !== i))}
                  className="text-text-secondary"
                >
                  x
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={ruleInput}
              onChange={(e) => setRuleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRule();
                }
              }}
              placeholder="Price closes above 50 EMA before entry"
              className="w-full"
            />
            <button type="button" onClick={addRule}>
              Add
            </button>
          </div>
        </div>

        <button type="submit" disabled={saving || !name.trim() || rules.length === 0} className="w-full">
          {saving ? "Creating..." : "Create playbook"}
        </button>
      </form>
    </div>
  );
}
