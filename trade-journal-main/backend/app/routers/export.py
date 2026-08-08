import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.db import get_service_client
from app.routers.trades import enrich_trade
from app.security import get_current_user_id

router = APIRouter(prefix="/export", tags=["export"])

COLUMNS = [
    "entry_time", "pair", "direction", "entry_price", "exit_price",
    "initial_sl", "tp", "lot_size", "pips", "pnl", "r_multiple",
    "session", "setup_tag", "exit_type", "followed_plan",
]

HEADERS = [
    "Entry time", "Pair", "Direction", "Entry", "Exit",
    "SL", "TP", "Lot size", "Pips", "P/L", "R multiple",
    "Session", "Setup", "Exit type", "Followed plan",
]


def fetch_trades(db, account_id: str, user_id: str) -> list[dict]:
    account = (
        db.table("accounts")
        .select("id, name")
        .eq("id", account_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not account.data:
        raise HTTPException(status_code=404, detail="Account not found")

    trades = (
        db.table("trades")
        .select("*")
        .eq("account_id", account_id)
        .order("entry_time")
        .execute()
    )
    return [enrich_trade(t) for t in trades.data], account.data[0]["name"]


@router.get("")
def export_trades(
    account_id: str,
    format: str = Query(..., pattern="^(csv|pdf)$"),
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    trades, account_name = fetch_trades(db, account_id, user_id)

    if format == "csv":
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(HEADERS)
        for t in trades:
            writer.writerow([t.get(c, "") for c in COLUMNS])
        buffer.seek(0)
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={account_name}-trades.csv"},
        )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    styles = getSampleStyleSheet()
    story = [Paragraph(f"{account_name} - Trade history", styles["Title"]), Spacer(1, 12)]

    table_data = [HEADERS]
    for t in trades:
        table_data.append([str(t.get(c, "")) for c in COLUMNS])

    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#262626")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#404040")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={account_name}-trades.pdf"},
    )
