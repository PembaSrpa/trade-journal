import type { EmotionalState } from "@/lib/types";

export const EMOTIONAL_STATES: EmotionalState[] = [
  "confident", "calm", "disciplined", "fomo", "greedy",
  "anxious", "hesitant", "revenge", "bored",
];

interface EmotionMeta {
  label: string;
  emoji: string;
  // "good" = constructive states, "bad" = states worth watching, "neutral" = context-dependent
  tone: "good" | "bad" | "neutral";
}

const META: Record<EmotionalState, EmotionMeta> = {
  confident: { label: "Confident", emoji: "💪", tone: "good" },
  calm: { label: "Calm", emoji: "🧘", tone: "good" },
  disciplined: { label: "Disciplined", emoji: "🎯", tone: "good" },
  hesitant: { label: "Hesitant", emoji: "🤔", tone: "neutral" },
  bored: { label: "Bored", emoji: "🥱", tone: "neutral" },
  anxious: { label: "Anxious", emoji: "😰", tone: "bad" },
  fomo: { label: "FOMO", emoji: "🏃", tone: "bad" },
  greedy: { label: "Greedy", emoji: "🤑", tone: "bad" },
  revenge: { label: "Revenge", emoji: "😡", tone: "bad" },
};

export function emotionMeta(state: string): EmotionMeta {
  return (META as Record<string, EmotionMeta>)[state] ?? { label: state, emoji: "❔", tone: "neutral" };
}

export function emotionToneClass(state: string): string {
  const tone = emotionMeta(state).tone;
  if (tone === "good") return "text-success";
  if (tone === "bad") return "text-danger";
  return "text-text-secondary";
}
