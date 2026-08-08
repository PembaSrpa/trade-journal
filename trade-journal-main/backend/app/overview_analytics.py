from collections import defaultdict
from datetime import datetime

from app.calculations import calc_pnl

REVENGE_WINDOW_MINUTES = 30


def enrich_closed_trade_pnl(trade: dict) -> float:
    return calc_pnl(
        trade["pair"], trade["direction"], trade["entry_price"], trade["exit_price"],
        trade["lot_size"], trade["lot_unit"], trade.get("commission", 0), trade.get("swap", 0),
    )


def compute_daily_pnl(closed_trades: list[dict]) -> dict[str, float]:
    daily: dict[str, float] = defaultdict(float)
    for t in closed_trades:
        day = t["exit_time"][:10]
        daily[day] += enrich_closed_trade_pnl(t)
    return {day: round(pnl, 2) for day, pnl in daily.items()}


def compute_setup_breakdown(closed_trades: list[dict]) -> list[dict]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for t in closed_trades:
        tag = t.get("setup_tag") or "Untagged"
        groups[tag].append(t)

    breakdown = []
    for tag, trades in groups.items():
        pnls = [enrich_closed_trade_pnl(t) for t in trades]
        wins = sum(1 for p in pnls if p > 0)
        breakdown.append(
            {
                "setup_tag": tag,
                "trade_count": len(trades),
                "win_rate": round(wins / len(trades) * 100, 1) if trades else 0.0,
                "net_pnl": round(sum(pnls), 2),
            }
        )
    breakdown.sort(key=lambda b: b["net_pnl"], reverse=True)
    return breakdown


def compute_streaks(closed_trades_sorted: list[dict]) -> dict[str, int]:
    current_streak = 0
    longest_win = 0
    longest_loss = 0
    running_win = 0
    running_loss = 0

    for t in closed_trades_sorted:
        pnl = enrich_closed_trade_pnl(t)
        if pnl > 0:
            running_win += 1
            running_loss = 0
            longest_win = max(longest_win, running_win)
        elif pnl < 0:
            running_loss += 1
            running_win = 0
            longest_loss = max(longest_loss, running_loss)
        else:
            running_win = 0
            running_loss = 0

    if closed_trades_sorted:
        last_pnl = enrich_closed_trade_pnl(closed_trades_sorted[-1])
        if last_pnl > 0:
            current_streak = running_win
        elif last_pnl < 0:
            current_streak = -running_loss
        else:
            current_streak = 0

    return {
        "current_streak": current_streak,
        "longest_win_streak": longest_win,
        "longest_loss_streak": longest_loss,
    }


def compute_expectancy_and_profit_factor(closed_trades: list[dict]) -> dict[str, float]:
    pnls = [enrich_closed_trade_pnl(t) for t in closed_trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]

    win_rate = len(wins) / len(pnls) if pnls else 0
    loss_rate = len(losses) / len(pnls) if pnls else 0
    avg_win = sum(wins) / len(wins) if wins else 0.0
    avg_loss = abs(sum(losses) / len(losses)) if losses else 0.0

    expectancy = (win_rate * avg_win) - (loss_rate * avg_loss)

    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0.0

    return {
        "expectancy": round(expectancy, 2),
        "profit_factor": round(profit_factor, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
    }


def compute_best_worst_day(daily_pnl: dict[str, float]) -> dict[str, dict | None]:
    if not daily_pnl:
        return {"best_day": None, "worst_day": None}

    best_date = max(daily_pnl, key=lambda d: daily_pnl[d])
    worst_date = min(daily_pnl, key=lambda d: daily_pnl[d])

    return {
        "best_day": {"date": best_date, "pnl": daily_pnl[best_date]},
        "worst_day": {"date": worst_date, "pnl": daily_pnl[worst_date]},
    }


def compute_emotion_breakdown(closed_trades: list[dict]) -> list[dict]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for t in closed_trades:
        emotion = t.get("emotional_state") or "untagged"
        groups[emotion].append(t)

    breakdown = []
    for emotion, trades in groups.items():
        pnls = [enrich_closed_trade_pnl(t) for t in trades]
        wins = sum(1 for p in pnls if p > 0)
        confidences = [t["confidence_score"] for t in trades if t.get("confidence_score") is not None]
        breakdown.append(
            {
                "emotional_state": emotion,
                "trade_count": len(trades),
                "win_rate": round(wins / len(trades) * 100, 1) if trades else 0.0,
                "net_pnl": round(sum(pnls), 2),
                "avg_confidence": round(sum(confidences) / len(confidences), 1) if confidences else None,
            }
        )
    breakdown.sort(key=lambda b: b["net_pnl"], reverse=True)
    return breakdown


def compute_session_breakdown(closed_trades: list[dict]) -> list[dict]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for t in closed_trades:
        session = t.get("session") or "unknown"
        groups[session].append(t)

    breakdown = []
    for session, trades in groups.items():
        pnls = [enrich_closed_trade_pnl(t) for t in trades]
        wins = sum(1 for p in pnls if p > 0)
        breakdown.append(
            {
                "session": session,
                "trade_count": len(trades),
                "win_rate": round(wins / len(trades) * 100, 1) if trades else 0.0,
                "net_pnl": round(sum(pnls), 2),
            }
        )
    breakdown.sort(key=lambda b: b["net_pnl"], reverse=True)
    return breakdown


def compute_rule_adherence_trend(closed_trades: list[dict]) -> list[dict]:
    daily: dict[str, list[float]] = defaultdict(list)
    for t in closed_trades:
        rule_checks = t.get("rule_checks") or {}
        if not rule_checks or not t.get("exit_time"):
            continue
        checked = sum(1 for v in rule_checks.values() if v)
        pct = checked / len(rule_checks) * 100
        day = t["exit_time"][:10]
        daily[day].append(pct)

    return [
        {"date": day, "adherence_percent": round(sum(vals) / len(vals), 1)}
        for day, vals in sorted(daily.items())
    ]


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def flag_revenge_trades(trades_sorted_by_entry_asc: list[dict], window_minutes: int = REVENGE_WINDOW_MINUTES) -> dict[str, bool]:
    """A trade is flagged as a revenge trade if it was opened within `window_minutes`
    of the close of the immediately preceding CLOSED trade, and that preceding trade
    was a loss. Requires trades sorted by entry_time ascending (per account)."""
    flags: dict[str, bool] = {}
    last_loss_exit: datetime | None = None

    for t in trades_sorted_by_entry_asc:
        entry_dt = _parse_dt(t.get("entry_time"))
        is_revenge = False
        if last_loss_exit is not None and entry_dt is not None:
            gap_minutes = (entry_dt - last_loss_exit).total_seconds() / 60
            if 0 <= gap_minutes <= window_minutes:
                is_revenge = True
        flags[t["id"]] = is_revenge

        if t.get("status") == "closed" and t.get("exit_price") is not None and t.get("exit_time") and t.get("entry_price") is not None:
            pnl = enrich_closed_trade_pnl(t)
            last_loss_exit = _parse_dt(t["exit_time"]) if pnl < 0 else None

    return flags
