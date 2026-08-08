"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen, Save } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { useAccountContext } from "@/lib/AccountContext";
import { isCombinedSelection } from "@/lib/accountSelection";
import type { NotebookEntry } from "@/lib/types";

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export default function NotebookPage() {
  const { selectedAccountId, syncNonce } = useAccountContext();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [content, setContent] = useState("");
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipNextSyncRef = useRef(false);

  useEffect(() => {
    if (!selectedAccountId || isCombinedSelection(selectedAccountId)) return;
    setLoading(true);
    apiGet<NotebookEntry[]>(`/notebook?account_id=${selectedAccountId}`)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [selectedAccountId, syncNonce]);

  useEffect(() => {
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const existing = entries.find((e) => e.entry_date === selectedDate);
    setContent(existing?.content ?? "");
  }, [selectedDate, entries]);

  if (!selectedAccountId || isCombinedSelection(selectedAccountId)) {
    return (
      <p className="text-text-secondary text-sm">
        Select a specific account to use the notebook.
      </p>
    );
  }

  async function handleSave() {
    if (!selectedAccountId || !content.trim()) return;
    setSaving(true);
    const saved = await apiPost<NotebookEntry>("/notebook", {
      account_id: selectedAccountId,
      entry_date: selectedDate,
      content: content.trim(),
    });
    setEntries((prev) => {
      const rest = prev.filter((e) => e.entry_date !== saved.entry_date);
      return [saved, ...rest].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
    });
    skipNextSyncRef.current = true;
    setContent("");
    setSaving(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  function handleEditClick(date: string) {
    setSelectedDate(date);
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    textareaRef.current?.focus();
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <p className="text-xl font-medium tracking-tight">Notebook</p>
        <p className="text-xs text-text-muted mt-0.5">
          Pre-market bias, session reviews, anything not tied to one trade
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <div
            ref={editorRef}
            className="bg-surface border border-border rounded-2xl p-5 lg:sticky lg:top-6 scroll-mt-20"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-accent-dim flex items-center justify-center flex-shrink-0">
                <NotebookPen size={14} className="text-accent-glow" />
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="!bg-transparent !border-none !p-0 !text-sm font-medium w-auto"
              />
            </div>

            <textarea
              ref={textareaRef}
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's my bias today? What am I watching for? How did the session go?"
              className="w-full mb-3"
            />

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !content.trim()}
                className="bg-accent border-accent hover:bg-accent-glow text-white font-medium flex items-center gap-2 text-sm"
              >
                <Save size={14} /> {saving ? "Saving..." : "Save entry"}
              </button>
              {justSaved && <span className="text-xs text-success">Saved</span>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <p className="text-sm text-text-secondary mb-3">Past entries</p>
          {loading ? (
            <p className="text-text-secondary text-sm">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-text-secondary text-sm">No notebook entries yet.</p>
          ) : (
            <div className="columns-1 xl:columns-2 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4">
              {entries.map((entry) => {
                const expanded = expandedId === entry.id;
                const isLong = entry.content.length > 280;
                return (
                  <div
                    key={entry.id}
                    className="bg-surface border border-border rounded-2xl p-4 hover:border-border-strong transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-text-muted">{entry.entry_date}</p>
                      <button
                        onClick={() => handleEditClick(entry.entry_date)}
                        className="!bg-transparent !border-none !p-0 text-xs text-accent-glow"
                      >
                        Edit
                      </button>
                    </div>
                    <p
                      className={`text-sm leading-relaxed whitespace-pre-wrap ${
                        expanded ? "" : "line-clamp-6"
                      }`}
                    >
                      {entry.content}
                    </p>
                    {isLong && (
                      <button
                        onClick={() => setExpandedId(expanded ? null : entry.id)}
                        className="!bg-transparent !border-none !p-0 text-xs text-text-secondary mt-2"
                      >
                        {expanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
