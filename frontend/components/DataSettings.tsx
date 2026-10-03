"use client";

import { useEffect, useRef, useState } from "react";
import { Download, KeyRound, Lock, Newspaper, Upload } from "lucide-react";
import { getRepo } from "@/lib/local";
import {
  BackupError, backupFilename, buildBackup, importBackup, parseBackup,
  type BackupFile, type ImportReport,
} from "@/lib/local/backup";
import { readFileAsText, saveTextFile } from "@/lib/local/files";
import { hasPin, removePin, setPin as savePin } from "@/lib/appLock";
import { useAccountContext } from "@/lib/AccountContext";
import { useConfirm } from "@/components/ConfirmDialog";

const LAST_EXPORT_KEY = "journal_last_export_at";

function Section({ icon: Icon, title, children }: { icon: typeof Download; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-accent-glow" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      {children}
    </div>
  );
}

function summarize(r: ImportReport): string {
  const a = r.added;
  const parts = [
    `${a.accounts} account${a.accounts === 1 ? "" : "s"}`,
    `${a.trades} trade${a.trades === 1 ? "" : "s"}`,
    `${a.playbooks} playbook${a.playbooks === 1 ? "" : "s"}`,
    `${a.notebook} notebook entr${a.notebook === 1 ? "y" : "ies"}`,
    `${a.screenshots} screenshot${a.screenshots === 1 ? "" : "s"}`,
  ];
  const skipped = Object.values(r.skipped).reduce((x, y) => x + y, 0);
  return (
    `Imported ${parts.join(", ")}.` +
    (skipped ? ` Skipped ${skipped} that already existed.` : "") +
    (r.dropped ? ` Ignored ${r.dropped} orphaned record${r.dropped === 1 ? "" : "s"}.` : "")
  );
}

export function DataSettings() {
  const { refreshAccounts, triggerSync } = useAccountContext();
  const confirmDialog = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);

  const [newsKey, setNewsKey] = useState("");
  const [hasNewsKey, setHasNewsKey] = useState(false);

  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    setLastExport(localStorage.getItem(LAST_EXPORT_KEY));
    getRepo().raw.get("meta", "finnhub_key").then((r) => setHasNewsKey(!!r));
    hasPin().then(setLocked);
  }, []);

  const daysSinceExport = lastExport ? Math.floor((Date.now() - Date.parse(lastExport)) / 86_400_000) : null;

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    try {
      const backup = await buildBackup(getRepo().raw);
      await saveTextFile(backupFilename(), JSON.stringify(backup), "application/json");
      const now = new Date().toISOString();
      localStorage.setItem(LAST_EXPORT_KEY, now);
      setLastExport(now);
      const d = backup.data;
      setMessage({ tone: "ok", text: `Exported ${d.accounts.length} accounts, ${d.trades.length} trades, ${d.screenshots.length} screenshots.` });
    } catch (e) {
      // The user closing the share sheet isn't an error worth showing.
      if (!/cancel|abort|dismiss/i.test((e as Error).message)) {
        setMessage({ tone: "error", text: `Export failed: ${(e as Error).message}` });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(null);
    try {
      setPending(parseBackup(await readFileAsText(file)));
    } catch (err) {
      setPending(null);
      setMessage({ tone: "error", text: err instanceof BackupError ? err.message : "Couldn't read that file." });
    }
  }

  async function runImport(mode: "merge" | "replace") {
    if (!pending) return;
    if (mode === "replace") {
      const ok = await confirmDialog({
        title: "Replace all data on this device?",
        description:
          "Everything currently in the app will be deleted and replaced by the backup. Export a backup of your current data first if you might need it.",
        confirmLabel: "Replace everything",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const report = await importBackup(getRepo().raw, pending, mode);
      setPending(null);
      await refreshAccounts();
      triggerSync();
      setMessage({ tone: "ok", text: summarize(report) });
    } catch (err) {
      setMessage({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function saveNewsKey() {
    const key = newsKey.trim();
    if (!key) return;
    await getRepo().raw.putMany("meta", [{ id: "finnhub_key", value: key }]);
    setNewsKey("");
    setHasNewsKey(true);
    setMessage({ tone: "ok", text: "News key saved on this device." });
  }

  async function clearNewsKey() {
    await getRepo().raw.deleteMany("meta", ["finnhub_key"]);
    setHasNewsKey(false);
  }

  async function handleSetPin() {
    try {
      await savePin(pin);
      setPin("");
      setLocked(true);
      window.dispatchEvent(new Event("app-lock-changed"));
      setMessage({ tone: "ok", text: "App lock is on. It re-locks after a minute in the background." });
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    }
  }

  async function handleRemovePin() {
    await removePin();
    setLocked(false);
    window.dispatchEvent(new Event("app-lock-changed"));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">Backup &amp; privacy</p>

      <Section icon={Download} title="Your data lives on this device">
        <p className="text-xs text-text-secondary">
          Nothing is uploaded anywhere. Export a backup file to keep a copy safe or move to another device — if you
          clear the app&apos;s data or uninstall it, the journal is gone unless you have a backup.
        </p>
        {daysSinceExport === null ? (
          <p className="text-xs text-amber-400">You haven&apos;t exported a backup yet.</p>
        ) : (
          <p className={`text-xs ${daysSinceExport > 30 ? "text-amber-400" : "text-text-muted"}`}>
            Last backup: {daysSinceExport === 0 ? "today" : `${daysSinceExport} day${daysSinceExport === 1 ? "" : "s"} ago`}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} disabled={busy} className="flex items-center gap-1.5 text-sm">
            <Download size={14} /> Export backup
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex items-center gap-1.5 text-sm">
            <Upload size={14} /> Import backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} className="hidden" />
        </div>

        {pending && (
          <div className="border border-border-strong rounded-xl p-3 space-y-2">
            <p className="text-sm font-medium">Backup ready to import</p>
            <p className="text-xs text-text-secondary">
              {pending.data.accounts.length} accounts · {pending.data.trades.length} trades ·{" "}
              {pending.data.playbooks.length} playbooks · {pending.data.notebook.length} notebook entries ·{" "}
              {pending.data.screenshots.length} screenshots
              {pending.exported_at ? ` · exported ${new Date(pending.exported_at).toLocaleDateString()}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => runImport("merge")} disabled={busy} className="text-sm bg-accent border-accent text-white">
                Merge into existing data
              </button>
              <button onClick={() => runImport("replace")} disabled={busy} className="text-sm hover:text-danger hover:border-danger/50">
                Replace everything
              </button>
              <button onClick={() => setPending(null)} disabled={busy} className="text-sm">Cancel</button>
            </div>
            <p className="text-xs text-text-muted">
              Merge only adds what&apos;s missing and never overwrites or duplicates — safe to run twice.
            </p>
          </div>
        )}
        {message && (
          <p className={`text-xs ${message.tone === "error" ? "text-danger" : "text-success"}`}>{message.text}</p>
        )}
      </Section>

      <Section icon={Lock} title="App lock">
        <p className="text-xs text-text-secondary">
          A PIN screen that hides the journal from anyone glancing at your screen. It doesn&apos;t encrypt the stored data.
        </p>
        {locked ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-success flex-1">PIN lock is on.</p>
            <button onClick={handleRemovePin} className="text-sm">Turn off</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="4–8 digit PIN"
              className="flex-1 min-w-0"
            />
            <button onClick={handleSetPin} disabled={pin.length < 4} className="text-sm flex items-center gap-1.5">
              <KeyRound size={14} /> Set PIN
            </button>
          </div>
        )}
      </Section>

      <Section icon={Newspaper} title="Market news (optional, needs internet)">
        <p className="text-xs text-text-secondary">
          The only feature that goes online. Paste a free Finnhub API key to show headlines on the Overview page. The
          key is stored on this device only.
        </p>
        {hasNewsKey ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-success flex-1">A news key is saved.</p>
            <button onClick={clearNewsKey} className="text-sm">Remove</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="password"
              value={newsKey}
              onChange={(e) => setNewsKey(e.target.value)}
              placeholder="Finnhub API key"
              className="flex-1 min-w-0"
            />
            <button onClick={saveNewsKey} disabled={!newsKey.trim()} className="text-sm">Save</button>
          </div>
        )}
      </Section>
    </div>
  );
}
