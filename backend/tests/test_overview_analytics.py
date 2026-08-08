from app.overview_analytics import (
    compute_best_worst_day,
    compute_daily_pnl,
    compute_expectancy_and_profit_factor,
    compute_setup_breakdown,
    compute_streaks,
)


def trade(exit_time, entry=1.0, exit=1.01, direction="long", setup_tag="Breakout", lot_size=1.0):
    return {
        "pair": "EUR/USD",
        "direction": direction,
        "entry_price": entry,
        "exit_price": exit,
        "lot_size": lot_size,
        "lot_unit": "standard",
        "commission": 0,
        "swap": 0,
        "exit_time": exit_time,
        "setup_tag": setup_tag,
    }


def test_daily_pnl_groups_by_exit_date():
    trades = [
        trade("2026-07-28T10:00:00+00:00", 1.0, 1.01),
        trade("2026-07-28T14:00:00+00:00", 1.0, 0.99, direction="short"),
        trade("2026-07-29T10:00:00+00:00", 1.0, 1.02),
    ]
    daily = compute_daily_pnl(trades)
    assert set(daily.keys()) == {"2026-07-28", "2026-07-29"}
    assert daily["2026-07-28"] > 0


def test_setup_breakdown_groups_and_sorts_by_pnl():
    trades = [
        trade("2026-07-28T10:00:00+00:00", 1.0, 1.02, setup_tag="Breakout"),
        trade("2026-07-28T11:00:00+00:00", 1.0, 0.98, setup_tag="News"),
    ]
    breakdown = compute_setup_breakdown(trades)
    assert breakdown[0]["setup_tag"] == "Breakout"
    assert breakdown[0]["net_pnl"] > breakdown[1]["net_pnl"]


def test_setup_breakdown_untagged_bucket():
    trades = [trade("2026-07-28T10:00:00+00:00", setup_tag=None)]
    breakdown = compute_setup_breakdown(trades)
    assert breakdown[0]["setup_tag"] == "Untagged"


def test_streaks_all_wins():
    trades = [trade(f"2026-07-{d:02d}T10:00:00+00:00", 1.0, 1.01) for d in range(20, 23)]
    result = compute_streaks(trades)
    assert result["current_streak"] == 3
    assert result["longest_win_streak"] == 3
    assert result["longest_loss_streak"] == 0


def test_streaks_mixed_ends_on_loss():
    trades = [
        trade("2026-07-20T10:00:00+00:00", 1.0, 1.01),
        trade("2026-07-21T10:00:00+00:00", 1.0, 1.01),
        trade("2026-07-22T10:00:00+00:00", 1.0, 0.99),
    ]
    result = compute_streaks(trades)
    assert result["current_streak"] == -1
    assert result["longest_win_streak"] == 2
    assert result["longest_loss_streak"] == 1


def test_streaks_empty():
    result = compute_streaks([])
    assert result["current_streak"] == 0
    assert result["longest_win_streak"] == 0
    assert result["longest_loss_streak"] == 0


def test_expectancy_and_profit_factor():
    trades = [
        trade("2026-07-20T10:00:00+00:00", 1.0, 1.02),
        trade("2026-07-21T10:00:00+00:00", 1.0, 0.99),
    ]
    result = compute_expectancy_and_profit_factor(trades)
    assert result["avg_win"] > 0
    assert result["avg_loss"] > 0
    assert result["profit_factor"] > 0


def test_expectancy_no_losses_gives_zero_profit_factor_guard():
    trades = [trade("2026-07-20T10:00:00+00:00", 1.0, 1.02)]
    result = compute_expectancy_and_profit_factor(trades)
    assert result["avg_loss"] == 0.0
    assert result["profit_factor"] == 0.0


def test_best_worst_day():
    daily = {"2026-07-28": 100.0, "2026-07-29": -50.0, "2026-07-30": 20.0}
    result = compute_best_worst_day(daily)
    assert result["best_day"]["date"] == "2026-07-28"
    assert result["worst_day"]["date"] == "2026-07-29"


def test_best_worst_day_empty():
    result = compute_best_worst_day({})
    assert result["best_day"] is None
    assert result["worst_day"] is None
