from fastapi import APIRouter, Depends, HTTPException, Query

from app.calculations import calc_hold_minutes, calc_pips, calc_pnl, calc_r_multiple, calc_session
from app.db import get_service_client
from app.models import TradeCreate, TradeOut, TradeUpdate
from app.overview_analytics import flag_revenge_trades
from app.security import get_current_user_id

router = APIRouter(prefix="/trades", tags=["trades"])


def assert_account_ownership(db, account_id: str, user_id: str):
    result = (
        db.table("accounts")
        .select("id, broker_timezone_offset")
        .eq("id", account_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Account not found")
    return result.data[0]


def revenge_flags_for_account(db, account_id: str) -> dict[str, bool]:
    """Fetch the full chronological trade history for an account and flag revenge trades.
    Needs the whole history (not just a page) since context comes from prior trades."""
    rows = (
        db.table("trades")
        .select("id, entry_time, exit_time, status, entry_price, exit_price, pair, asset_class, direction, lot_size, lot_unit, commission, swap")
        .eq("account_id", account_id)
        .order("entry_time")
        .execute()
        .data
    )
    return flag_revenge_trades(rows)


def enrich_trade(row: dict) -> dict:
    row = dict(row)
    if row.get("exit_price") is not None:
        asset_class = row.get("asset_class", "forex")
        row["pips"] = calc_pips(asset_class, row["pair"], row["direction"], row["entry_price"], row["exit_price"])
        row["pnl"] = calc_pnl(
            asset_class,
            row["pair"],
            row["direction"],
            row["entry_price"],
            row["exit_price"],
            row["lot_size"],
            row["lot_unit"],
            row.get("commission", 0),
            row.get("swap", 0),
        )
        row["r_multiple"] = calc_r_multiple(
            row["direction"], row["entry_price"], row["exit_price"], row.get("initial_sl")
        )
    else:
        row["pips"] = None
        row["pnl"] = None
        row["r_multiple"] = None
    row["hold_minutes"] = calc_hold_minutes(row["entry_time"], row.get("exit_time"))

    rule_checks = row.get("rule_checks") or {}
    if rule_checks:
        checked = sum(1 for v in rule_checks.values() if v)
        row["rule_adherence_percent"] = round(checked / len(rule_checks) * 100, 1)
    else:
        row["rule_adherence_percent"] = None

    return row


@router.get("", response_model=list[TradeOut])
def list_trades(
    account_id: str,
    status: str | None = None,
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    sort: str = "desc",
    page: int = 1,
    page_size: int = 10,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    assert_account_ownership(db, account_id, user_id)

    query = db.table("trades").select("*").eq("account_id", account_id)
    if status:
        query = query.eq("status", status)
    if from_date:
        query = query.gte("entry_time", from_date)
    if to_date:
        query = query.lte("entry_time", to_date)

    query = query.order("entry_time", desc=(sort == "desc"))
    start = (page - 1) * page_size
    end = start + page_size - 1
    query = query.range(start, end)

    result = query.execute()
    trade_ids = [row["id"] for row in result.data]

    screenshots = (
        db.table("trade_screenshots").select("trade_id, url").in_("trade_id", trade_ids).execute()
        if trade_ids
        else type("obj", (), {"data": []})()
    )
    screenshot_map = {s["trade_id"]: s["url"] for s in screenshots.data}

    tags_result = (
        db.table("trade_tags").select("trade_id, tag").in_("trade_id", trade_ids).execute()
        if trade_ids
        else type("obj", (), {"data": []})()
    )
    tags_map: dict[str, list[str]] = {}
    for t in tags_result.data:
        tags_map.setdefault(t["trade_id"], []).append(t["tag"])

    enriched = []
    for row in result.data:
        row["screenshot_url"] = screenshot_map.get(row["id"])
        row["tags"] = tags_map.get(row["id"], [])
        enriched.append(enrich_trade(row))

    if enriched:
        revenge_flags = revenge_flags_for_account(db, account_id)
        for row in enriched:
            row["is_revenge_trade"] = revenge_flags.get(row["id"], False)

    return enriched


@router.post("", response_model=TradeOut)
def create_trade(
    payload: TradeCreate,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    account = assert_account_ownership(db, payload.account_id, user_id)

    row = payload.model_dump(exclude={"tags", "screenshot_url"})
    row["entry_time"] = row["entry_time"].isoformat()
    if row.get("exit_time"):
        row["exit_time"] = row["exit_time"].isoformat()
        row["status"] = "closed"
    else:
        row["status"] = "open"

    row["session"] = calc_session(payload.entry_time, account["broker_timezone_offset"])

    result = db.table("trades").insert(row).execute()
    trade = result.data[0]

    if payload.tags:
        tag_rows = [{"trade_id": trade["id"], "tag": tag} for tag in payload.tags]
        db.table("trade_tags").insert(tag_rows).execute()

    if payload.screenshot_url:
        db.table("trade_screenshots").insert(
            {"trade_id": trade["id"], "url": payload.screenshot_url}
        ).execute()
        trade["screenshot_url"] = payload.screenshot_url

    return enrich_trade(trade)


@router.get("/{trade_id}", response_model=TradeOut)
def get_trade(
    trade_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    result = db.table("trades").select("*").eq("id", trade_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Trade not found")
    trade = result.data[0]
    assert_account_ownership(db, trade["account_id"], user_id)

    screenshot = (
        db.table("trade_screenshots").select("url").eq("trade_id", trade_id).limit(1).execute()
    )
    trade["screenshot_url"] = screenshot.data[0]["url"] if screenshot.data else None

    tags_result = db.table("trade_tags").select("tag").eq("trade_id", trade_id).execute()
    trade["tags"] = [t["tag"] for t in tags_result.data]

    revenge_flags = revenge_flags_for_account(db, trade["account_id"])
    trade["is_revenge_trade"] = revenge_flags.get(trade["id"], False)

    return enrich_trade(trade)


@router.patch("/{trade_id}", response_model=TradeOut)
def update_trade(
    trade_id: str,
    payload: TradeUpdate,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    existing = db.table("trades").select("*").eq("id", trade_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Trade not found")
    trade = existing.data[0]
    assert_account_ownership(db, trade["account_id"], user_id)

    # exclude_unset (not exclude_none) so that explicitly clearing an optional
    # field — sending null for exit_price, tp, exit_type, playbook_id, etc. —
    # actually clears it in the database instead of being silently dropped
    # and leaving the previous value in place.
    updates = payload.model_dump(exclude_unset=True, exclude={"screenshot_url", "tags"})
    if "entry_time" in updates and updates["entry_time"] is not None:
        updates["entry_time"] = updates["entry_time"].isoformat()
        account = assert_account_ownership(db, trade["account_id"], user_id)
        updates["session"] = calc_session(payload.entry_time, account["broker_timezone_offset"])
    if "exit_time" in updates and updates["exit_time"] is not None:
        updates["exit_time"] = updates["exit_time"].isoformat()
    if updates.get("exit_price") is not None and updates.get("status") is None:
        updates["status"] = "closed"

    result = db.table("trades").update(updates).eq("id", trade_id).execute()
    updated = result.data[0]

    if payload.screenshot_url:
        db.table("trade_screenshots").delete().eq("trade_id", trade_id).execute()
        db.table("trade_screenshots").insert(
            {"trade_id": trade_id, "url": payload.screenshot_url}
        ).execute()
        updated["screenshot_url"] = payload.screenshot_url

    if payload.tags is not None:
        db.table("trade_tags").delete().eq("trade_id", trade_id).execute()
        if payload.tags:
            db.table("trade_tags").insert(
                [{"trade_id": trade_id, "tag": tag} for tag in payload.tags]
            ).execute()
        updated["tags"] = payload.tags
    else:
        existing_tags = db.table("trade_tags").select("tag").eq("trade_id", trade_id).execute()
        updated["tags"] = [t["tag"] for t in existing_tags.data]

    return enrich_trade(updated)


@router.delete("/{trade_id}")
def delete_trade(
    trade_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    existing = db.table("trades").select("*").eq("id", trade_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Trade not found")
    trade = existing.data[0]
    assert_account_ownership(db, trade["account_id"], user_id)

    db.table("trades").delete().eq("id", trade_id).execute()
    return {"deleted": True}
