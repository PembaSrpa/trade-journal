export type AccountType = "demo" | "live";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  starting_balance: number;
  broker_name: string | null;
  leverage: string | null;
  broker_timezone_offset: number;
  is_archived: boolean;
  created_at: string;
}

export type Direction = "long" | "short";
export type ExitType = "tp_hit" | "sl_hit" | "trailed_out" | "manual_close";
export type LotUnit = "standard" | "mini" | "micro";
export type TradeStatus = "open" | "closed";
export type EmotionalState =
  | "confident" | "calm" | "disciplined" | "fomo" | "greedy"
  | "anxious" | "hesitant" | "revenge" | "bored";

export interface Trade {
  id: string;
  account_id: string;
  pair: string;
  direction: Direction;
  status: TradeStatus;
  entry_price: number;
  exit_price: number | null;
  initial_sl: number | null;
  tp: number | null;
  lot_size: number;
  lot_unit: LotUnit;
  commission: number;
  swap: number;
  entry_time: string;
  exit_time: string | null;
  session: string | null;
  setup_tag: string | null;
  exit_type: ExitType | null;
  followed_plan: boolean;
  reasoning: string | null;
  lesson: string | null;
  screenshot_url: string | null;
  tags: string[];
  playbook_id: string | null;
  rule_checks: Record<string, boolean>;
  rule_adherence_percent: number | null;
  emotional_state: EmotionalState | null;
  confidence_score: number | null;
  is_revenge_trade: boolean;
  pips: number | null;
  r_multiple: number | null;
  pnl: number | null;
  hold_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlaybookRule {
  id: string;
  playbook_id: string;
  rule_text: string;
  sort_order: number;
}

export interface Playbook {
  id: string;
  account_id: string;
  name: string;
  is_archived: boolean;
  created_at: string;
  rules: PlaybookRule[];
}

export interface NotebookEntry {
  id: string;
  account_id: string;
  entry_date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface SetupBreakdown {
  setup_tag: string;
  trade_count: number;
  win_rate: number;
  net_pnl: number;
}

export interface EmotionBreakdown {
  emotional_state: string;
  trade_count: number;
  win_rate: number;
  net_pnl: number;
  avg_confidence: number | null;
}

export interface SessionBreakdown {
  session: string;
  trade_count: number;
  win_rate: number;
  net_pnl: number;
}

export interface RuleAdherencePoint {
  date: string;
  adherence_percent: number;
}

export interface DayExtreme {
  date: string;
  pnl: number;
}

export interface Stats {
  win_rate: number;
  avg_r_multiple: number;
  net_pnl: number;
  current_balance: number;
  avg_hold_minutes: number;
  max_drawdown: number;
  open_trades: number;
  closed_trades: number;
  equity_curve: { time: string; equity: number }[];
  daily_pnl: Record<string, number>;
  setup_breakdown: SetupBreakdown[];
  emotion_breakdown: EmotionBreakdown[];
  session_breakdown: SessionBreakdown[];
  rule_adherence_trend: RuleAdherencePoint[];
  revenge_trade_count: number;
  current_streak: number;
  longest_win_streak: number;
  longest_loss_streak: number;
  expectancy: number;
  profit_factor: number;
  best_day: DayExtreme | null;
  worst_day: DayExtreme | null;
  avg_win: number;
  avg_loss: number;
}
