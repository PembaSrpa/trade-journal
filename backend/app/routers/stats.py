from fastapi import APIRouter, Depends, HTTPException

from app.calculations import calc_hold_minutes, calc_pnl, calc_r_multiple
from app.db import get_service_client
from app.models import StatsOut
from app.overview_analytics import (
    compute_best_worst_day,
    compute_daily_pnl,
    compute_emotion_breakdown,
    compute_expectancy_and_profit_factor,
    compute_rule_adherence_trend,
    compute_session_breakdown,
    compute_setup_breakdown,
    compute_streaks,
    flag_revenge_trades,
)
from app.security import get_current_user_id

router = APIRouter(prefix="/stats", tags=["stats"])


def fetch_accounts(db, user_id: str, account_id: str | None, account_type: str | None):
    query = db.table("accounts").select("*").eq("user_id", user_id).eq("is_archived", False)
    if account_id:
        query = query.eq("id", account_id)
    elif account_type:
        query = query.eq("type", account_type)
    accounts = query.execute().data
    if not accounts:
        raise HTTPException(status_code=404, detail="No matching accounts found")
    return accounts


def compute_stats(db, accounts: list[dict], from_date: str | None, to_date: str | None) -> StatsOut:
    account_ids = [a["id"] for a in accounts]

    trades_query = db.table("trades").select("*").in_("account_id", account_ids)
    if from_date:
        trades_query = trades_query.gte("entry_time", from_date)
    if to_date:
        trades_query = trades_query.lte("entry_time", to_date)
    trades = trades_query.execute().data

    closed = [t for t in trades if t["status"] == "closed" and t.get("exit_price") is not None]
    open_count = len([t for t in trades if t["status"] == "open"])

    transactions = (
        db.table("account_transactions")
        .select("*")
        .in_("account_id", account_ids)
        .execute()
        .data
    )

    events = []
    for t in closed:
        pnl = calc_pnl(
            t["pair"], t["direction"], t["entry_price"], t["exit_price"],
            t["lot_size"], t["lot_unit"], t.get("commission", 0), t.get("swap", 0),
        )
        events.append({"time": t["exit_time"], "delta": pnl})
    for tx in transactions:
        amount = tx["amount"] if tx["type"] != "withdrawal" else -tx["amount"]
        events.append({"time": tx["occurred_at"], "delta": amount})

    events.sort(key=lambda e: e["time"])

    starting_balance = sum(float(a["starting_balance"]) for a in accounts)
    earliest_created = min(a["created_at"] for a in accounts)

    equity = starting_balance
    equity_curve = [{"time": earliest_created, "equity": equity}]
    peak = equity
    max_drawdown = 0.0

    for e in events:
        equity += e["delta"]
        equity_curve.append({"time": e["time"], "equity": round(equity, 2)})
        peak = max(peak, equity)
        drawdown = (peak - equity) / peak * 100 if peak > 0 else 0
        max_drawdown = max(max_drawdown, drawdown)

    current_balance = round(equity, 2)

    wins = 0
    r_multiples = []
    hold_minutes_list = []
    net_pnl = 0.0

    for t in closed:
        pnl = calc_pnl(
            t["pair"], t["direction"], t["entry_price"], t["exit_price"],
            t["lot_size"], t["lot_unit"], t.get("commission", 0), t.get("swap", 0),
        )
        net_pnl += pnl
        if pnl > 0:
            wins += 1
        r = calc_r_multiple(t["direction"], t["entry_price"], t["exit_price"], t.get("initial_sl"))
        if r is not None:
            r_multiples.append(r)
        hold = calc_hold_minutes(t["entry_time"], t.get("exit_time"))
        if hold is not None:
            hold_minutes_list.append(hold)

    win_rate = round(wins / len(closed) * 100, 1) if closed else 0.0
    avg_r = round(sum(r_multiples) / len(r_multiples), 2) if r_multiples else 0.0
    avg_hold = int(sum(hold_minutes_list) / len(hold_minutes_list)) if hold_minutes_list else 0

    closed_sorted = sorted(closed, key=lambda t: t["exit_time"])
    daily_pnl = compute_daily_pnl(closed)
    setup_breakdown = compute_setup_breakdown(closed)
    emotion_breakdown = compute_emotion_breakdown(closed)
    session_breakdown = compute_session_breakdown(closed)
    rule_adherence_trend = compute_rule_adherence_trend(closed)
    streaks = compute_streaks(closed_sorted)
    expectancy_stats = compute_expectancy_and_profit_factor(closed)
    day_extremes = compute_best_worst_day(daily_pnl)

    trades_sorted_by_entry = sorted(trades, key=lambda t: t["entry_time"])
    revenge_flags = flag_revenge_trades(trades_sorted_by_entry)
    revenge_trade_count = sum(1 for v in revenge_flags.values() if v)

    return StatsOut(
        win_rate=win_rate,
        avg_r_multiple=avg_r,
        net_pnl=round(net_pnl, 2),
        current_balance=current_balance,
        avg_hold_minutes=avg_hold,
        max_drawdown=round(max_drawdown, 2),
        open_trades=open_count,
        closed_trades=len(closed),
        equity_curve=equity_curve,
        daily_pnl=daily_pnl,
        setup_breakdown=setup_breakdown,
        emotion_breakdown=emotion_breakdown,
        session_breakdown=session_breakdown,
        rule_adherence_trend=rule_adherence_trend,
        revenge_trade_count=revenge_trade_count,
        current_streak=streaks["current_streak"],
        longest_win_streak=streaks["longest_win_streak"],
        longest_loss_streak=streaks["longest_loss_streak"],
        expectancy=expectancy_stats["expectancy"],
        profit_factor=expectancy_stats["profit_factor"],
        best_day=day_extremes["best_day"],
        worst_day=day_extremes["worst_day"],
        avg_win=expectancy_stats["avg_win"],
        avg_loss=expectancy_stats["avg_loss"],
    )


@router.get("", response_model=StatsOut)
def get_stats(
    account_id: str | None = None,
    account_type: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    if not account_id and not account_type:
        raise HTTPException(status_code=400, detail="account_id or account_type is required")

    db = get_service_client()
    accounts = fetch_accounts(db, user_id, account_id, account_type)
    return compute_stats(db, accounts, from_date, to_date)
