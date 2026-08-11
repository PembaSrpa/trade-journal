"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  NotebookPen,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAccountContext } from "@/lib/AccountContext";
import { isCombinedSelection } from "@/lib/accountSelection";
import { readCache, writeCache } from "@/lib/dataCache";
import type { SyncStatus } from "@/lib/useCachedFetch";
import { NotebookEntriesSkeleton } from "@/components/skeletons/NotebookSkeleton";
import type { NotebookEntry } from "@/lib/types";
import { DateTimePicker } from "@/components/DateTimePicker";

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export default function NotebookPage() {
  const { selectedAccountId, syncNonce } = useAccountContext();
  const confirmDialog = useConfirm();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [content, setContent] = useState("");
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("initial");
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [query, setQuery] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipNextSyncRef = useRef(false);

  useEffect(() => {
    if (!selectedAccountId || isCombinedSelection(selectedAccountId)) return;
    const cacheKey = `notebook:${selectedAccountId}`;
    let cancelled = false;

    setLoading(true);
    readCache<NotebookEntry[]>(cacheKey).then((cached) => {
      if (cancelled || !cached) return;
      setEntries(cached.data);
      setCachedAt(cached.cachedAt);
      setStatus("revalidating");
      setLoading(false);
    });

    apiGet<NotebookEntry[]>(`/notebook?account_id=${selectedAccountId}`)
      .then((data) => {
        if (cancelled) return;
        setEntries(data);
        const now = new Date().toISOString();
        setCachedAt(now);
        setStatus("live");
        void writeCache(cacheKey, data);
      })
      .catch(() => {
        if (!cancelled) setStatus((s) => (s === "revalidating" ? "cached" : "error"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, syncNonce]);

  useEffect(() => {
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const existing = entries.find((e) => e.entry_date === selectedDate);
    setContent(existing?.content ?? "");
  }, [selectedDate, entries]);

  const existingEntry = entries.find((e) => e.entry_date === selectedDate);
  const isDirty = content.trim() !== (existingEntry?.content ?? "").trim();

  const filteredEntries = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) => e.content.toLowerCase().includes(q) || e.entry_date.includes(q)
    );
  }, [entries, query]);

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
      const next = [saved, ...rest].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
      void writeCache(`notebook:${selectedAccountId}`, next);
      return next;
    });
    skipNextSyncRef.current = true;
    setContent(saved.content);
    setSaving(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  }

  function handleEditClick(date: string) {
    setSelectedDate(date);
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    textareaRef.current?.focus();
  }

  async function handleDelete(entry: NotebookEntry) {
    const ok = await confirmDialog({
      title: "Delete this notebook entry?",
      description: `Entry for ${entry.entry_date}. This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await apiDelete(`/notebook/${entry.id}`);
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== entry.id);
      void writeCache(`notebook:${selectedAccountId}`, next);
      return next;
    });
    if (entry.entry_date === selectedDate) {
      skipNextSyncRef.current = true;
      setContent("");
    }
  }

  const isToday = selectedDate === todayISO();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <p className="text-xl font-medium tracking-tight">Notebook</p>
        {entries.length > 0 && (
          <p className="text-xs text-text-muted">{entries.length} entr{entries.length === 1 ? "y" : "ies"}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <div
            ref={editorRef}
            className="bg-surface border border-border rounded-2xl p-5 lg:sticky lg:top-6 scroll-mt-20"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-accent-dim flex items-center justify-center flex-shrink-0">
                  <NotebookPen size={14} className="text-accent-glow" />
                </div>
                <p className="text-sm font-medium truncate">{formatDateLabel(selectedDate)}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
                  aria-label="Previous day"
                  className="!w-7 !h-7 !p-0 flex items-center justify-center"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
                  aria-label="Next day"
                  disabled={isToday}
                  className="!w-7 !h-7 !p-0 flex items-center justify-center"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1">
                <DateTimePicker mode="date" value={selectedDate} onChange={setSelectedDate} />
              </div>
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(todayISO())}
                  className="!text-xs flex-shrink-0"
                >
                  Today
                </button>
              )}
            </div>

            <textarea
              ref={textareaRef}
              rows={11}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's my bias today? What am I watching for? How did the session go?"
              className="w-full mb-2"
            />

            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-text-muted">{wordCount(content)} words</p>
              {isDirty && content.trim() && (
                <p className="text-xs text-warning">Unsaved</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !content.trim() || !isDirty}
                className="bg-accent border-accent hover:bg-accent-glow text-white font-medium flex items-center gap-2 text-sm"
              >
                <Save size={14} /> {saving ? "Saving..." : existingEntry ? "Update entry" : "Save entry"}
              </button>
              {justSaved && <span className="text-xs text-success">Saved</span>}
              {!justSaved && (
                <span className="text-xs text-text-muted hidden sm:inline">Ctrl+Enter to save</span>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm text-text-secondary">Past entries</p>
            {entries.length > 0 && (
              <div className="relative w-48">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search entries"
                  className="!text-xs w-full !pl-7 !py-1.5 !border-none !bg-surface focus:!ring-1 focus:!ring-border-strong"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="!absolute !right-1 !top-1/2 !-translate-y-1/2 !w-5 !h-5 !p-0 !border-none !bg-transparent flex items-center justify-center text-text-muted"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            )}
          </div>

          {loading && entries.length === 0 && status === "initial" ? (
            <NotebookEntriesSkeleton />
          ) : entries.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-10 text-center">
              <div className="w-10 h-10 rounded-full bg-accent-dim flex items-center justify-center mx-auto mb-3">
                <NotebookPen size={16} className="text-accent-glow" />
              </div>
              <p className="text-sm text-text-secondary mb-1">No notebook entries yet.</p>
              <p className="text-xs text-text-muted">
                Write your first one on the left, then save with the button or Ctrl+Enter.
              </p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <p className="text-text-secondary text-sm">No entries match &quot;{query}&quot;.</p>
          ) : (
            <div className="columns-1 xl:columns-2 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4">
              {filteredEntries.map((entry) => {
                const expanded = expandedId === entry.id;
                const isLong = entry.content.length > 280;
                const isActive = entry.entry_date === selectedDate;
                return (
                  <div
                    key={entry.id}
                    className={`bg-surface border rounded-2xl p-4 transition-colors ${
                      isActive ? "border-accent/50" : "border-border hover:border-border-strong"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-xs text-text-muted truncate">{entry.entry_date}</p>
                        {isActive && (
                          <span className="text-xs text-accent-glow bg-accent-dim rounded-full px-2 py-0.5 flex-shrink-0">
                            Editing
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                          onClick={() => handleEditClick(entry.entry_date)}
                          className="!bg-transparent !border-none !p-0 text-xs text-accent-glow"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(entry)}
                          className="!bg-transparent !border-none !p-0 text-xs text-text-muted hover:text-danger flex items-center gap-1"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
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
