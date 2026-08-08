from fastapi import APIRouter, Depends, HTTPException

from app.db import get_service_client
from app.models import PlaybookCreate, PlaybookOut
from app.security import get_current_user_id

router = APIRouter(prefix="/playbooks", tags=["playbooks"])


def assert_account_ownership(db, account_id: str, user_id: str):
    result = db.table("accounts").select("id").eq("id", account_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Account not found")


def attach_rules(db, playbooks: list[dict]) -> list[dict]:
    if not playbooks:
        return []
    playbook_ids = [p["id"] for p in playbooks]
    rules = (
        db.table("playbook_rules")
        .select("*")
        .in_("playbook_id", playbook_ids)
        .order("sort_order")
        .execute()
        .data
    )
    rules_map: dict[str, list[dict]] = {}
    for r in rules:
        rules_map.setdefault(r["playbook_id"], []).append(r)
    for p in playbooks:
        p["rules"] = rules_map.get(p["id"], [])
    return playbooks


@router.get("", response_model=list[PlaybookOut])
def list_playbooks(
    account_id: str,
    include_archived: bool = False,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    assert_account_ownership(db, account_id, user_id)

    query = db.table("playbooks").select("*").eq("account_id", account_id)
    if not include_archived:
        query = query.eq("is_archived", False)
    playbooks = query.order("created_at").execute().data
    return attach_rules(db, playbooks)


@router.post("", response_model=PlaybookOut)
def create_playbook(
    payload: PlaybookCreate,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    assert_account_ownership(db, payload.account_id, user_id)

    result = (
        db.table("playbooks")
        .insert({"account_id": payload.account_id, "name": payload.name})
        .execute()
    )
    playbook = result.data[0]

    if payload.rules:
        rule_rows = [
            {"playbook_id": playbook["id"], "rule_text": r.rule_text, "sort_order": r.sort_order}
            for r in payload.rules
        ]
        db.table("playbook_rules").insert(rule_rows).execute()

    return attach_rules(db, [playbook])[0]


@router.patch("/{playbook_id}/archive", response_model=PlaybookOut)
def archive_playbook(
    playbook_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    existing = db.table("playbooks").select("*").eq("id", playbook_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Playbook not found")
    assert_account_ownership(db, existing.data[0]["account_id"], user_id)

    result = db.table("playbooks").update({"is_archived": True}).eq("id", playbook_id).execute()
    return attach_rules(db, [result.data[0]])[0]
