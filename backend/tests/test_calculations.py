import pytest

from app.calculations import (
    calc_hold_minutes,
    calc_pips,
    calc_pnl,
    calc_r_multiple,
    calc_session,
    pip_size,
)


def test_pip_size_jpy_pair():
    assert pip_size("USD/JPY") == 0.01
    assert pip_size("EUR/JPY") == 0.01


def test_pip_size_non_jpy_pair():
    assert pip_size("EUR/USD") == 0.0001
    assert pip_size("GBP/USD") == 0.0001


def test_pip_size_metals_and_oil_use_coarse_pip():
    assert pip_size("XAU/USD") == 0.01
    assert pip_size("XAG/USD") == 0.01
    assert pip_size("USOIL") == 0.01


def test_calc_pips_long_win():
    assert calc_pips("forex", "EUR/USD", "long", 1.0842, 1.0891) == 49.0


def test_calc_pips_long_loss():
    assert calc_pips("forex", "EUR/USD", "long", 1.0842, 1.0812) == -30.0


def test_calc_pips_short_win():
    assert calc_pips("forex", "EUR/USD", "short", 1.0842, 1.0812) == 30.0


def test_calc_pips_short_loss():
    assert calc_pips("forex", "EUR/USD", "short", 1.0842, 1.0891) == -49.0


def test_calc_pips_jpy_pair():
    assert calc_pips("forex", "USD/JPY", "long", 150.00, 150.50) == 50.0


def test_calc_pnl_standard_lot():
    pnl = calc_pnl("forex", "EUR/USD", "long", 1.0842, 1.0891, 1.0, "standard", 0, 0)
    assert pnl == 490.0


def test_calc_pnl_mini_lot():
    pnl = calc_pnl("forex", "EUR/USD", "long", 1.0842, 1.0891, 1.0, "mini", 0, 0)
    assert pnl == 49.0


def test_calc_pnl_micro_lot():
    pnl = calc_pnl("forex", "EUR/USD", "long", 1.0842, 1.0891, 1.0, "micro", 0, 0)
    assert pnl == 4.9


def test_calc_pnl_subtracts_commission_adds_swap():
    pnl = calc_pnl("forex", "EUR/USD", "long", 1.0842, 1.0891, 1.0, "standard", 5, 2)
    assert pnl == 487.0


def test_calc_pnl_loss():
    pnl = calc_pnl("forex", "EUR/USD", "long", 1.0891, 1.0842, 0.1, "standard", 0, 0)
    assert pnl < 0


# --- Point-based asset classes (index, stock, crypto) ---


def test_calc_pips_index_returns_raw_points_not_forex_pips():
    # A 50 point move on an index is 50 points, not 500000 "pips" like the
    # old forex-only math would have produced.
    assert calc_pips("index", "US500", "long", 5000, 5050) == 50.0


def test_calc_pips_stock_short():
    assert calc_pips("stock", "TSLA", "short", 250, 240) == 10.0


def test_calc_pnl_index_uses_price_move_times_lot_size():
    # 3 contracts, +50 points => 150, lot_unit is ignored for point-based classes
    pnl = calc_pnl("index", "US500", "long", 5000, 5050, 3, "units", 0, 0)
    assert pnl == 150.0


def test_calc_pnl_stock_uses_shares_times_price_move():
    # 10 shares, entry 250 -> exit 260 = $10/share * 10 shares = $100
    pnl = calc_pnl("stock", "TSLA", "long", 250, 260, 10, "units", 0, 0)
    assert pnl == 100.0


def test_calc_pnl_crypto_short():
    pnl = calc_pnl("crypto", "BTC/USD", "short", 65000, 64000, 0.5, "units", 0, 0)
    assert pnl == 500.0


def test_calc_pnl_index_still_applies_commission_and_swap():
    pnl = calc_pnl("index", "US500", "long", 5000, 5050, 1, "units", 2, 1)
    assert pnl == 49.0


# --- R-multiple, hold time, session (asset-agnostic, unaffected by this change) ---


def test_calc_r_multiple_positive():
    r = calc_r_multiple("long", 1.0842, 1.0891, 1.0812)
    assert r == pytest.approx(1.63, abs=0.01)


def test_calc_r_multiple_negative():
    r = calc_r_multiple("long", 1.0842, 1.0812, 1.0812)
    assert r == -1.0


def test_calc_r_multiple_none_when_no_sl():
    assert calc_r_multiple("long", 1.0842, 1.0891, None) is None


def test_calc_r_multiple_none_when_zero_risk():
    assert calc_r_multiple("long", 1.0842, 1.0891, 1.0842) is None


def test_calc_hold_minutes_with_string_timestamps():
    minutes = calc_hold_minutes("2026-07-28T08:15:00+00:00", "2026-07-28T10:40:00+00:00")
    assert minutes == 145


def test_calc_hold_minutes_none_when_open():
    assert calc_hold_minutes("2026-07-28T08:15:00+00:00", None) is None


def test_calc_hold_minutes_overnight():
    minutes = calc_hold_minutes("2026-07-28T22:00:00+00:00", "2026-07-29T02:00:00+00:00")
    assert minutes == 240


def test_calc_session_london_with_string_timestamp():
    assert calc_session("2026-07-28T08:15:00+00:00", 0) == "london"


def test_calc_session_new_york():
    assert calc_session("2026-07-28T14:00:00+00:00", 0) == "new_york"


def test_calc_session_asia():
    assert calc_session("2026-07-28T20:15:00+00:00", 0) == "asia"


def test_calc_session_respects_broker_offset():
    assert calc_session("2026-07-28T05:00:00+00:00", 3) == "london"


def test_calc_session_offset_wraps_past_midnight():
    assert calc_session("2026-07-28T22:00:00+00:00", 3) == "asia"
