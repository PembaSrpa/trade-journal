import type { EmotionalState } from "@/lib/types";

export const EMOTIONAL_STATES: EmotionalState[] = [
  "confident", "calm", "disciplined", "fomo", "greedy",
  "anxious", "hesitant", "revenge", "bored",
];

interface EmotionMeta {
  label: string;
  // "good" = constructive states, "bad" = states worth watching, "neutral" = context-dependent
  tone: "good" | "bad" | "neutral";
}

const META: Record<EmotionalState, EmotionMeta> = {
  confident: { label: "Confident", tone: "good" },
  calm: { label: "Calm", tone: "good" },
  disciplined: { label: "Disciplined", tone: "good" },
  hesitant: { label: "Hesitant", tone: "neutral" },
  bored: { label: "Bored", tone: "neutral" },
  anxious: { label: "Anxious", tone: "bad" },
  fomo: { label: "FOMO", tone: "bad" },
  greedy: { label: "Greedy", tone: "bad" },
  revenge: { label: "Revenge", tone: "bad" },
};

export function emotionMeta(state: string): EmotionMeta {
  return (META as Record<string, EmotionMeta>)[state] ?? { label: state, tone: "neutral" };
}

export function emotionToneClass(state: string): string {
  const tone = emotionMeta(state).tone;
  if (tone === "good") return "text-success";
  if (tone === "bad") return "text-danger";
  return "text-text-secondary";
}
