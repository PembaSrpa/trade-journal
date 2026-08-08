from app.overview_analytics import (
    compute_emotion_breakdown,
    compute_rule_adherence_trend,
    compute_session_breakdown,
    flag_revenge_trades,
)
from app.routers.trades import revenge_flags_for_account


def trade(
    trade_id,
    entry_time,
    exit_time=None,
    entry=1.0,
    exit=1.01,
    direction="long",
    status="closed",
    emotional_state=None,
    confidence_score=None,
    session=None,
    rule_checks=None,
):
    return {
        "id": trade_id,
        "pair": "EUR/USD",
        "direction": direction,
        "entry_price": entry,
        "exit_price": exit if status == "closed" else None,
        "lot_size": 1.0,
        "lot_unit": "standard",
        "commission": 0,
        "swap": 0,
        "entry_time": entry_time,
        "exit_time": exit_time,
        "status": status,
        "emotional_state": emotional_state,
        "confidence_score": confidence_score,
        "session": session,
        "rule_checks": rule_checks or {},
    }


def test_emotion_breakdown_groups_and_averages_confidence():
    trades = [
        trade("1", "2026-07-28T10:00:00+00:00", "2026-07-28T11:00:00+00:00", 1.0, 1.02,
              emotional_state="confident", confidence_score=4),
        trade("2", "2026-07-28T12:00:00+00:00", "2026-07-28T13:00:00+00:00", 1.0, 1.01,
              emotional_state="confident", confidence_score=5),
        trade("3", "2026-07-28T14:00:00+00:00", "2026-07-28T15:00:00+00:00", 1.0, 0.98,
              emotional_state="fomo", confidence_score=2),
    ]
    breakdown = compute_emotion_breakdown(trades)
    by_state = {b["emotional_state"]: b for b in breakdown}
    assert by_state["confident"]["trade_count"] == 2
    assert by_state["confident"]["avg_confidence"] == 4.5
    assert by_state["confident"]["win_rate"] == 100.0
    assert by_state["fomo"]["win_rate"] == 0.0


def test_emotion_breakdown_untagged_bucket():
    trades = [trade("1", "2026-07-28T10:00:00+00:00", "2026-07-28T11:00:00+00:00")]
    breakdown = compute_emotion_breakdown(trades)
    assert breakdown[0]["emotional_state"] == "untagged"
    assert breakdown[0]["avg_confidence"] is None


def test_session_breakdown_groups_by_session():
    trades = [
        trade("1", "2026-07-28T10:00:00+00:00", "2026-07-28T11:00:00+00:00", 1.0, 1.02, session="london"),
        trade("2", "2026-07-28T14:00:00+00:00", "2026-07-28T15:00:00+00:00", 1.0, 0.99, session="new_york"),
    ]
    breakdown = compute_session_breakdown(trades)
    sessions = {b["session"] for b in breakdown}
    assert sessions == {"london", "new_york"}


def test_rule_adherence_trend_averages_per_day():
    trades = [
        trade("1", "2026-07-28T10:00:00+00:00", "2026-07-28T11:00:00+00:00",
              rule_checks={"a": True, "b": False}),
        trade("2", "2026-07-28T12:00:00+00:00", "2026-07-28T13:00:00+00:00",
              rule_checks={"a": True, "b": True}),
    ]
    trend = compute_rule_adherence_trend(trades)
    assert trend == [{"date": "2026-07-28", "adherence_percent": 75.0}]


def test_rule_adherence_trend_skips_trades_without_playbook():
    trades = [trade("1", "2026-07-28T10:00:00+00:00", "2026-07-28T11:00:00+00:00", rule_checks={})]
    assert compute_rule_adherence_trend(trades) == []


def test_revenge_trade_flagged_after_quick_loss():
    trades = [
        trade("1", "2026-07-28T10:00:00+00:00", "2026-07-28T10:30:00+00:00", 1.0, 0.99),  # loss
        trade("2", "2026-07-28T10:40:00+00:00", "2026-07-28T11:00:00+00:00", 1.0, 1.01),  # opened 10 min later
    ]
    flags = flag_revenge_trades(trades)
    assert flags["1"] is False
    assert flags["2"] is True


def test_revenge_trade_not_flagged_after_win():
    trades = [
        trade("1", "2026-07-28T10:00:00+00:00", "2026-07-28T10:30:00+00:00", 1.0, 1.01),  # win
        trade("2", "2026-07-28T10:40:00+00:00", "2026-07-28T11:00:00+00:00", 1.0, 1.02),
    ]
    flags = flag_revenge_trades(trades)
    assert flags["2"] is False


def test_revenge_trade_not_flagged_outside_window():
    trades = [
        trade("1", "2026-07-28T10:00:00+00:00", "2026-07-28T10:30:00+00:00", 1.0, 0.99),  # loss
        trade("2", "2026-07-28T14:00:00+00:00", "2026-07-28T15:00:00+00:00", 1.0, 1.01),  # hours later
    ]
    flags = flag_revenge_trades(trades)
    assert flags["2"] is False


def test_revenge_trade_open_trade_does_not_break_flagging():
    trades = [
        trade("1", "2026-07-28T10:00:00+00:00", "2026-07-28T10:30:00+00:00", 1.0, 0.99),  # loss
        trade("2", "2026-07-28T10:35:00+00:00", None, status="open"),  # still open
    ]
    flags = flag_revenge_trades(trades)
    assert flags["2"] is True


class _FakeQuery:
    """Minimal stand-in for the supabase query builder chain."""

    def __init__(self, rows, captured_selects):
        self._rows = rows
        self._captured_selects = captured_selects

    def select(self, columns):
        self._captured_selects.append(columns)
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        return self

    @property
    def data(self):
        return self._rows


class _FakeDb:
    """Returns rows containing ONLY the columns actually requested via .select(),
    to catch a select() list that's missing a field flag_revenge_trades relies on."""

    def __init__(self, full_rows):
        self._full_rows = full_rows
        self.captured_selects: list[str] = []

    def table(self, _name):
        query = _FakeQuery(self._full_rows, self.captured_selects)

        original_select = query.select

        def select_and_project(columns):
            original_select(columns)
            wanted = [c.strip() for c in columns.split(",")]
            query._rows = [{k: row.get(k) for k in wanted} for row in self._full_rows]
            return query

        query.select = select_and_project
        return query


def test_revenge_flags_for_account_select_includes_every_field_it_needs():
    """Regression test: revenge_flags_for_account's hand-picked .select(...) column
    list must include every field flag_revenge_trades touches (previously missing
    entry_price caused a KeyError in production, see trades.py list_trades)."""
    full_rows = [
        trade("1", "2026-07-28T10:00:00+00:00", "2026-07-28T10:30:00+00:00", 1.0, 0.99, session="london"),
        trade("2", "2026-07-28T10:35:00+00:00", "2026-07-28T11:00:00+00:00", 1.0, 1.01, session="london"),
    ]
    db = _FakeDb(full_rows)

    # Should not raise KeyError even though the projected rows only contain the
    # exact columns revenge_flags_for_account asks the DB for.
    flags = revenge_flags_for_account(db, "account-1")

    assert flags["2"] is True
