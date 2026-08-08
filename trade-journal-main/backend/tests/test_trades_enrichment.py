import pytest

from app.routers.trades import enrich_trade


def base_row(**overrides):
    row = {
        "id": "trade-1",
        "account_id": "account-1",
        "pair": "EUR/USD",
        "direction": "long",
        "status": "closed",
        "entry_price": 1.0842,
        "exit_price": 1.0891,
        "initial_sl": 1.0812,
        "tp": None,
        "lot_size": 1.0,
        "lot_unit": "standard",
        "commission": 0,
        "swap": 0,
        "entry_time": "2026-07-28T08:15:00+00:00",
        "exit_time": "2026-07-28T10:40:00+00:00",
    }
    row.update(overrides)
    return row


def test_enrich_trade_computes_pips_pnl_r_multiple():
    result = enrich_trade(base_row())
    assert result["pips"] == 49.0
    assert result["pnl"] == 490.0
    assert result["r_multiple"] == 1.63


def test_enrich_trade_computes_hold_minutes():
    result = enrich_trade(base_row())
    assert result["hold_minutes"] == 145


def test_enrich_trade_open_trade_has_no_outcome_fields():
    row = base_row(status="open", exit_price=None, exit_time=None)
    result = enrich_trade(row)
    assert result["pips"] is None
    assert result["pnl"] is None
    assert result["r_multiple"] is None
    assert result["hold_minutes"] is None


def test_enrich_trade_does_not_mutate_input():
    row = base_row()
    original = dict(row)
    enrich_trade(row)
    assert row == original


def test_enrich_trade_rule_adherence_percent():
    row = base_row(rule_checks={"rule-1": True, "rule-2": True, "rule-3": False})
    result = enrich_trade(row)
    assert result["rule_adherence_percent"] == pytest.approx(66.7, abs=0.1)


def test_enrich_trade_rule_adherence_none_when_no_playbook():
    row = base_row()
    result = enrich_trade(row)
    assert result["rule_adherence_percent"] is None


def test_enrich_trade_rule_adherence_full_compliance():
    row = base_row(rule_checks={"rule-1": True, "rule-2": True})
    result = enrich_trade(row)
    assert result["rule_adherence_percent"] == 100.0
