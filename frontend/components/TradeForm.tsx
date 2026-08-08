"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { apiGet } from "@/lib/api";
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShieldCheck,
  Image as ImageIcon,
  BookMarked,
  PenLine,
  Tag as TagIcon,
  Check,
  Brain,
} from "lucide-react";
import type { Direction, EmotionalState, ExitType, LotUnit, Playbook, Trade } from "@/lib/types";
import { EMOTIONAL_STATES, emotionMeta } from "@/lib/emotions";

interface TradeFormProps {
  accountId: string;
  initial?: Partial<Trade>;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
  className = "",
  bodyClassName = "",
}: {
  icon: typeof Clock;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`bg-surface border border-border rounded-2xl p-5 ${className}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent-dim flex items-center justify-center flex-shrink-0">
          <Icon size={14} className="text-accent-glow" />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
        </div>
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function TradeForm({ accountId, initial, onSubmit, submitLabel }: TradeFormProps) {
  const [pair, setPair] = useState(initial?.pair ?? "EUR/USD");
  const [direction, setDirection] = useState<Direction>(initial?.direction ?? "long");
  const [entryPrice, setEntryPrice] = useState(initial?.entry_price?.toString() ?? "");
  const [exitPrice, setExitPrice] = useState(initial?.exit_price?.toString() ?? "");
  const [entryTime, setEntryTime] = useState(
    initial?.entry_time ? toLocalInput(initial.entry_time) : ""
  );
  const [exitTime, setExitTime] = useState(
    initial?.exit_time ? toLocalInput(initial.exit_time) : ""
  );
  const [initialSl, setInitialSl] = useState(initial?.initial_sl?.toString() ?? "");
  const [tp, setTp] = useState(initial?.tp?.toString() ?? "");
  const [lotSize, setLotSize] = useState(initial?.lot_size?.toString() ?? "0.1");
  const [lotUnit, setLotUnit] = useState<LotUnit>(initial?.lot_unit ?? "standard");
  const [exitType, setExitType] = useState<ExitType | "">(initial?.exit_type ?? "");
  const [setupTag, setSetupTag] = useState(initial?.setup_tag ?? "");
  const [reasoning, setReasoning] = useState(initial?.reasoning ?? "");
  const [lesson, setLesson] = useState(initial?.lesson ?? "");
  const [followedPlan, setFollowedPlan] = useState(initial?.followed_plan ?? true);
  const [emotionalState, setEmotionalState] = useState<EmotionalState | "">(initial?.emotional_state ?? "");
  const [confidenceScore, setConfidenceScore] = useState<number | "">(initial?.confidence_score ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [playbookId, setPlaybookId] = useState<string>(initial?.playbook_id ?? "");
  const [ruleChecks, setRuleChecks] = useState<Record<string, boolean>>(initial?.rule_checks ?? {});
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Playbook[]>(`/playbooks?account_id=${accountId}`).then(setPlaybooks);
  }, [accountId]);

  function toLocalInput(iso: string) {
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  async function uploadScreenshot(): Promise<string | null> {
    if (!screenshot) return null;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const path = `${user.id}/${Date.now()}-${screenshot.name}`;
    const { error: uploadError } = await supabase.storage
      .from("screenshots")
      .upload(path, screenshot);

    if (uploadError) return null;

    return path;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (screenshot && screenshot.size > 5 * 1024 * 1024) {
        throw new Error("Screenshot must be under 5MB");
      }
      if (screenshot && !screenshot.type.startsWith("image/")) {
        throw new Error("Screenshot must be an image file");
      }

      const screenshotUrl = await uploadScreenshot();

      const payload: Record<string, unknown> = {
        account_id: accountId,
        pair,
        direction,
        entry_price: Number(entryPrice),
        exit_price: exitPrice ? Number(exitPrice) : null,
        initial_sl: initialSl ? Number(initialSl) : null,
        tp: tp ? Number(tp) : null,
        lot_size: Number(lotSize),
        lot_unit: lotUnit,
        entry_time: new Date(entryTime).toISOString(),
        exit_time: exitTime ? new Date(exitTime).toISOString() : null,
        exit_type: exitType || null,
        setup_tag: setupTag || null,
        reasoning: reasoning || null,
        lesson: lesson || null,
        followed_plan: followedPlan,
        tags,
        playbook_id: playbookId || null,
        rule_checks: playbookId ? ruleChecks : {},
        emotional_state: emotionalState || null,
        confidence_score: confidenceScore === "" ? null : Number(confidenceScore),
      };

      if (screenshotUrl) {
        payload.screenshot_url = screenshotUrl;
      }

      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const holdDuration =
    entryTime && exitTime
      ? formatDuration(new Date(exitTime).getTime() - new Date(entryTime).getTime())
      : null;

  const activePlaybook = playbooks.find((p) => p.id === playbookId);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="columns-1 lg:columns-2 2xl:columns-3 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4">
      <div className="bg-surface border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <input
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            className="!text-2xl !font-medium !bg-transparent !border-none !p-0 tracking-tight w-32"
            required
          />
          <div className="flex rounded-xl overflow-hidden border border-border">
            <button
              type="button"
              onClick={() => setDirection("long")}
              className={`!rounded-none !border-none flex items-center gap-1.5 text-sm ${
                direction === "long" ? "bg-success/15 text-success" : "bg-transparent text-text-muted"
              }`}
            >
              <ArrowUpRight size={14} /> Long
            </button>
            <button
              type="button"
              onClick={() => setDirection("short")}
              className={`!rounded-none !border-none flex items-center gap-1.5 text-sm ${
                direction === "short" ? "bg-danger/15 text-danger" : "bg-transparent text-text-muted"
              }`}
            >
              <ArrowDownRight size={14} /> Short
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Entry price</label>
            <input
              type="number"
              step="0.00001"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full !text-lg font-medium"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Entry time</label>
            <input
              type="datetime-local"
              value={entryTime}
              onChange={(e) => setEntryTime(e.target.value)}
              className="w-full"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Exit price</label>
            <input
              type="number"
              step="0.00001"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className="w-full !text-lg font-medium"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Exit time</label>
            <input
              type="datetime-local"
              value={exitTime}
              onChange={(e) => setExitTime(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {holdDuration && (
          <div className="bg-bg rounded-xl px-3.5 py-2.5 flex items-center justify-between text-sm mt-3">
            <span className="text-text-secondary flex items-center gap-1.5">
              <Clock size={13} /> Hold duration
            </span>
            <span className="font-medium">{holdDuration}</span>
          </div>
        )}
      </div>

      <SectionCard icon={Brain} title="Psychology" subtitle="How you felt going into this trade">
        <div className="mb-4">
          <label className="block text-xs text-text-secondary mb-2">Emotional state</label>
          <div className="grid grid-cols-3 gap-2">
            {EMOTIONAL_STATES.map((state) => {
              const meta = emotionMeta(state);
              const selected = emotionalState === state;
              return (
                <button
                  key={state}
                  type="button"
                  onClick={() => setEmotionalState(selected ? "" : state)}
                  className={`!rounded-xl flex flex-col items-center gap-1 py-2.5 text-xs ${
                    selected
                      ? "bg-accent-dim border-accent text-accent-glow"
                      : "bg-bg text-text-secondary"
                  }`}
                >
                  <span className="text-base leading-none">{meta.emoji}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs text-text-secondary mb-2">Confidence going in</label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setConfidenceScore(confidenceScore === n ? "" : n)}
                className={`!rounded-full !w-9 !h-9 !p-0 flex items-center justify-center text-sm ${
                  confidenceScore === n
                    ? "bg-accent border-accent text-white"
                    : "bg-bg text-text-secondary"
                }`}
              >
                {n}
              </button>
            ))}
            <span className="text-xs text-text-muted ml-1">
              {confidenceScore === "" ? "Not set" : confidenceScore === 1 ? "Low" : confidenceScore === 5 ? "High" : ""}
            </span>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="Risk & result">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Initial SL</label>
            <input
              type="number"
              step="0.00001"
              value={initialSl}
              onChange={(e) => setInitialSl(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">TP (optional)</label>
            <input
              type="number"
              step="0.00001"
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Lot size</label>
            <input
              type="number"
              step="0.01"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              className="w-full"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Lot unit</label>
            <select value={lotUnit} onChange={(e) => setLotUnit(e.target.value as LotUnit)} className="w-full">
              <option value="standard">Standard (100k)</option>
              <option value="mini">Mini (10k)</option>
              <option value="micro">Micro (1k)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-text-secondary mb-1">Exit type</label>
          <select value={exitType} onChange={(e) => setExitType(e.target.value as ExitType)} className="w-full">
            <option value="">Not closed yet</option>
            <option value="tp_hit">TP hit</option>
            <option value="sl_hit">SL hit</option>
            <option value="trailed_out">Trailed out</option>
            <option value="manual_close">Manual close</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard icon={BookMarked} title="Playbook" subtitle="Optional — attach a strategy and check its rules">
        <select
          value={playbookId}
          onChange={(e) => {
            setPlaybookId(e.target.value);
            setRuleChecks({});
          }}
          className="w-full mb-3"
        >
          <option value="">No playbook</option>
          {playbooks.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {activePlaybook && (
          <div className="bg-bg rounded-xl p-3.5 space-y-2.5">
            {activePlaybook.rules.map((rule) => {
              const checked = ruleChecks[rule.id] ?? false;
              return (
                <label key={rule.id} className="flex items-start gap-2.5 text-sm cursor-pointer">
                  <div
                    className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                      checked ? "bg-accent border-accent" : "border-border-strong"
                    }`}
                  >
                    {checked && <Check size={11} className="text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    onChange={(e) => setRuleChecks({ ...ruleChecks, [rule.id]: e.target.checked })}
                  />
                  <span className={checked ? "text-text" : "text-text-secondary"}>{rule.rule_text}</span>
                </label>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard icon={ImageIcon} title="Chart screenshot" subtitle="Optional, up to 5MB">
        <label className="flex flex-col items-center justify-center border border-dashed border-border-strong rounded-xl py-8 cursor-pointer hover:border-accent/60 transition-colors w-full min-h-[180px]">
          <ImageIcon size={22} className="text-text-muted mb-2" />
          <span className="text-sm text-text-secondary">
            {screenshot ? screenshot.name : "Tap to upload"}
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
      </SectionCard>
      </div>

      <SectionCard icon={PenLine} title="Reflection & tags">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-3">
              <label className="block text-xs text-text-secondary mb-1">Why I took this trade</label>
              <textarea rows={3} value={reasoning} onChange={(e) => setReasoning(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">What I learned</label>
              <textarea rows={3} value={lesson} onChange={(e) => setLesson(e.target.value)} className="w-full" />
            </div>
          </div>

          <div>
            <div className="mb-4">
              <label className="block text-xs text-text-secondary mb-1">Setup tag</label>
              <p className="text-xs text-text-muted mb-1.5">
                One label used to group this trade in your &quot;By setup&quot; stats.
              </p>
              <input value={setupTag} onChange={(e) => setSetupTag(e.target.value)} className="w-full" placeholder="Pullback EMA" />
            </div>

            <div className="flex items-center gap-1.5 mb-1">
              <TagIcon size={12} className="text-text-muted" />
              <label className="block text-xs text-text-secondary">Tags</label>
            </div>
            <p className="text-xs text-text-muted mb-1.5">
              Any number of freeform labels for context (mistakes, conditions, mood).
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-bg border border-border rounded-full px-2.5 py-1 flex items-center gap-1.5"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                    className="!bg-transparent !border-none !p-0 text-text-muted hover:text-danger"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  const value = tagInput.trim();
                  if (value && !tags.includes(value)) {
                    setTags([...tags, value]);
                  }
                  setTagInput("");
                }
              }}
              placeholder="FOMO, revenge trade, A+ setup — press Enter"
              className="w-full"
            />
          </div>
        </div>
      </SectionCard>

      <label className="flex items-center gap-2.5 bg-surface border border-border rounded-2xl p-4 cursor-pointer">
        <input
          type="checkbox"
          id="followedPlan"
          checked={followedPlan}
          onChange={(e) => setFollowedPlan(e.target.checked)}
          className="!w-auto"
        />
        <span className="text-sm">Followed my trading plan</span>
      </label>

      {error && <p className="text-danger text-sm">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-accent border-accent hover:bg-accent-glow text-white font-medium py-3"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function formatDuration(ms: number): string {
  if (ms < 0) return "";
  const minutes = Math.floor(ms / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
