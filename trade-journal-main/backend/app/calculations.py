from datetime import datetime, timezone

CONTRACT_SIZE = {
    "standard": 100000,
    "mini": 10000,
    "micro": 1000,
}

JPY_PIP_SIZE = 0.01
DEFAULT_PIP_SIZE = 0.0001


def pip_size(pair: str) -> float:
    return JPY_PIP_SIZE if "JPY" in pair.upper() else DEFAULT_PIP_SIZE


def calc_pips(pair: str, direction: str, entry_price: float, exit_price: float) -> float:
    size = pip_size(pair)
    diff = exit_price - entry_price
    if direction == "short":
        diff = -diff
    return round(diff / size, 1)


def calc_pnl(
    pair: str,
    direction: str,
    entry_price: float,
    exit_price: float,
    lot_size: float,
    lot_unit: str,
    commission: float,
    swap: float,
) -> float:
    pips = calc_pips(pair, direction, entry_price, exit_price)
    size = pip_size(pair)
    contract = CONTRACT_SIZE[lot_unit]
    pip_value = lot_size * contract * size
    gross = pips * pip_value
    return round(gross - commission + swap, 2)


def calc_r_multiple(
    direction: str,
    entry_price: float,
    exit_price: float,
    initial_sl: float,
) -> float | None:
    if initial_sl is None:
        return None
    risk = abs(entry_price - initial_sl)
    if risk == 0:
        return None
    reward = exit_price - entry_price
    if direction == "short":
        reward = -reward
    return round(reward / risk, 2)


def _as_datetime(value: datetime | str) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def calc_hold_minutes(entry_time: datetime | str, exit_time: datetime | str | None) -> int | None:
    if exit_time is None:
        return None
    delta = _as_datetime(exit_time) - _as_datetime(entry_time)
    return int(delta.total_seconds() // 60)


def calc_session(entry_time: datetime | str, broker_timezone_offset: int) -> str:
    entry = _as_datetime(entry_time)
    adjusted_hour = (entry.hour + broker_timezone_offset) % 24
    if 7 <= adjusted_hour < 12:
        return "london"
    if 12 <= adjusted_hour < 17:
        return "new_york"
    return "asia"
