from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

EmotionalState = Literal[
    "confident", "calm", "disciplined", "fomo", "greedy",
    "anxious", "hesitant", "revenge", "bored",
]


class AccountCreate(BaseModel):
    name: str
    type: Literal["demo", "live"]
    currency: str = "USD"
    starting_balance: float
    broker_name: Optional[str] = None
    leverage: Optional[str] = None
    broker_timezone_offset: int = 0


class AccountOut(AccountCreate):
    id: str
    user_id: str
    is_archived: bool
    created_at: datetime


class TradeCreate(BaseModel):
    account_id: str
    pair: str
    direction: Literal["long", "short"]
    entry_price: float
    exit_price: Optional[float] = None
    initial_sl: Optional[float] = None
    tp: Optional[float] = None
    lot_size: float
    lot_unit: Literal["standard", "mini", "micro"] = "standard"
    commission: float = 0
    swap: float = 0
    risk_percent: Optional[float] = None
    entry_time: datetime
    exit_time: Optional[datetime] = None
    setup_tag: Optional[str] = None
    exit_type: Optional[Literal["tp_hit", "sl_hit", "trailed_out", "manual_close"]] = None
    followed_plan: bool = True
    reasoning: Optional[str] = None
    lesson: Optional[str] = None
    tags: list[str] = []
    screenshot_url: Optional[str] = None
    playbook_id: Optional[str] = None
    rule_checks: dict[str, bool] = {}
    emotional_state: Optional[EmotionalState] = None
    confidence_score: Optional[int] = Field(None, ge=1, le=5)


class TradeUpdate(BaseModel):
    pair: Optional[str] = None
    direction: Optional[Literal["long", "short"]] = None
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    initial_sl: Optional[float] = None
    tp: Optional[float] = None
    lot_size: Optional[float] = None
    lot_unit: Optional[Literal["standard", "mini", "micro"]] = None
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    exit_type: Optional[Literal["tp_hit", "sl_hit", "trailed_out", "manual_close"]] = None
    setup_tag: Optional[str] = None
    lesson: Optional[str] = None
    reasoning: Optional[str] = None
    followed_plan: Optional[bool] = None
    status: Optional[Literal["open", "closed"]] = None
    screenshot_url: Optional[str] = None
    tags: Optional[list[str]] = None
    playbook_id: Optional[str] = None
    rule_checks: Optional[dict[str, bool]] = None
    emotional_state: Optional[EmotionalState] = None
    confidence_score: Optional[int] = Field(None, ge=1, le=5)


class TradeOut(BaseModel):
    id: str
    account_id: str
    pair: str
    direction: str
    status: str
    entry_price: float
    exit_price: Optional[float]
    initial_sl: Optional[float]
    tp: Optional[float]
    lot_size: float
    lot_unit: str
    commission: float
    swap: float
    entry_time: datetime
    exit_time: Optional[datetime]
    session: Optional[str]
    setup_tag: Optional[str]
    exit_type: Optional[str]
    followed_plan: bool
    reasoning: Optional[str]
    lesson: Optional[str]
    screenshot_url: Optional[str] = None
    tags: list[str] = []
    playbook_id: Optional[str] = None
    rule_checks: dict[str, bool] = {}
    rule_adherence_percent: Optional[float] = None
    emotional_state: Optional[EmotionalState] = None
    confidence_score: Optional[int] = None
    is_revenge_trade: bool = False
    pips: Optional[float] = None
    r_multiple: Optional[float] = None
    pnl: Optional[float] = None
    hold_minutes: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class SetupBreakdown(BaseModel):
    setup_tag: str
    trade_count: int
    win_rate: float
    net_pnl: float


class EmotionBreakdown(BaseModel):
    emotional_state: str
    trade_count: int
    win_rate: float
    net_pnl: float
    avg_confidence: Optional[float] = None


class SessionBreakdown(BaseModel):
    session: str
    trade_count: int
    win_rate: float
    net_pnl: float


class RuleAdherencePoint(BaseModel):
    date: str
    adherence_percent: float


class PlaybookRuleIn(BaseModel):
    rule_text: str
    sort_order: int = 0


class PlaybookRuleOut(PlaybookRuleIn):
    id: str
    playbook_id: str


class PlaybookCreate(BaseModel):
    account_id: str
    name: str
    rules: list[PlaybookRuleIn] = []


class PlaybookOut(BaseModel):
    id: str
    account_id: str
    name: str
    is_archived: bool
    created_at: datetime
    rules: list[PlaybookRuleOut] = []


class NotebookEntryCreate(BaseModel):
    account_id: str
    entry_date: str
    content: str


class NotebookEntryUpdate(BaseModel):
    content: str


class NotebookEntryOut(BaseModel):
    id: str
    account_id: str
    entry_date: str
    content: str
    created_at: datetime
    updated_at: datetime


class StatsOut(BaseModel):
    win_rate: float
    avg_r_multiple: float
    net_pnl: float
    avg_hold_minutes: int
    max_drawdown: float
    open_trades: int
    closed_trades: int
    equity_curve: list[dict]
    daily_pnl: dict[str, float]
    setup_breakdown: list[SetupBreakdown]
    emotion_breakdown: list[EmotionBreakdown]
    session_breakdown: list[SessionBreakdown]
    rule_adherence_trend: list[RuleAdherencePoint]
    revenge_trade_count: int
    current_streak: int
    longest_win_streak: int
    longest_loss_streak: int
    expectancy: float
    profit_factor: float
    best_day: dict | None
    worst_day: dict | None
    avg_win: float
    avg_loss: float
