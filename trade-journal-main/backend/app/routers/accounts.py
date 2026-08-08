from fastapi import APIRouter, Depends, HTTPException

from app.db import get_service_client
from app.models import AccountCreate, AccountOut
from app.security import get_current_user_id

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
def list_accounts(
    include_archived: bool = False,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    query = db.table("accounts").select("*").eq("user_id", user_id)
    if not include_archived:
        query = query.eq("is_archived", False)
    result = query.order("created_at").execute()
    return result.data


@router.post("", response_model=AccountOut)
def create_account(
    payload: AccountCreate,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    row = payload.model_dump()
    row["user_id"] = user_id
    result = db.table("accounts").insert(row).execute()
    return result.data[0]


@router.patch("/{account_id}/archive", response_model=AccountOut)
def archive_account(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    existing = (
        db.table("accounts")
        .select("id")
        .eq("id", account_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Account not found")

    result = (
        db.table("accounts")
        .update({"is_archived": True})
        .eq("id", account_id)
        .execute()
    )
    return result.data[0]


@router.delete("/{account_id}")
def delete_account(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    existing = (
        db.table("accounts")
        .select("id")
        .eq("id", account_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Account not found")

    db.table("accounts").delete().eq("id", account_id).execute()
    return {"deleted": True}
