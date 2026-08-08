from fastapi import APIRouter, Depends, HTTPException

from app.db import get_service_client
from app.models import NotebookEntryCreate, NotebookEntryOut, NotebookEntryUpdate
from app.security import get_current_user_id

router = APIRouter(prefix="/notebook", tags=["notebook"])


def assert_account_ownership(db, account_id: str, user_id: str):
    result = db.table("accounts").select("id").eq("id", account_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Account not found")


@router.get("", response_model=list[NotebookEntryOut])
def list_notebook_entries(
    account_id: str,
    from_date: str | None = None,
    to_date: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    assert_account_ownership(db, account_id, user_id)

    query = db.table("notebook_entries").select("*").eq("account_id", account_id)
    if from_date:
        query = query.gte("entry_date", from_date)
    if to_date:
        query = query.lte("entry_date", to_date)

    result = query.order("entry_date", desc=True).execute()
    return result.data


@router.get("/by-date", response_model=NotebookEntryOut | None)
def get_notebook_entry_by_date(
    account_id: str,
    entry_date: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    assert_account_ownership(db, account_id, user_id)

    result = (
        db.table("notebook_entries")
        .select("*")
        .eq("account_id", account_id)
        .eq("entry_date", entry_date)
        .execute()
    )
    return result.data[0] if result.data else None


@router.post("", response_model=NotebookEntryOut)
def upsert_notebook_entry(
    payload: NotebookEntryCreate,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    assert_account_ownership(db, payload.account_id, user_id)

    existing = (
        db.table("notebook_entries")
        .select("id")
        .eq("account_id", payload.account_id)
        .eq("entry_date", payload.entry_date)
        .execute()
    )

    if existing.data:
        result = (
            db.table("notebook_entries")
            .update({"content": payload.content})
            .eq("id", existing.data[0]["id"])
            .execute()
        )
    else:
        result = db.table("notebook_entries").insert(payload.model_dump()).execute()

    return result.data[0]


@router.delete("/{entry_id}")
def delete_notebook_entry(
    entry_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    existing = db.table("notebook_entries").select("*").eq("id", entry_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    assert_account_ownership(db, existing.data[0]["account_id"], user_id)

    db.table("notebook_entries").delete().eq("id", entry_id).execute()
    return {"deleted": True}
