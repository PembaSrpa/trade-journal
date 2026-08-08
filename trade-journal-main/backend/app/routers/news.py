import time

import httpx
from fastapi import APIRouter, Depends

from app.config import settings
from app.security import get_current_user_id

router = APIRouter(prefix="/news", tags=["news"])

_cache: dict[str, tuple[float, list[dict]]] = {}
CACHE_TTL_SECONDS = 900


@router.get("")
def get_news(
    category: str = "forex",
    pair: str | None = None,
    _user_id: str = Depends(get_current_user_id),
):
    cache_key = category
    now = time.time()

    if cache_key in _cache and now - _cache[cache_key][0] < CACHE_TTL_SECONDS:
        articles = _cache[cache_key][1]
    else:
        response = httpx.get(
            "https://finnhub.io/api/v1/news",
            params={"category": category, "token": settings.finnhub_api_key},
            timeout=10,
        )
        response.raise_for_status()
        articles = response.json()
        _cache[cache_key] = (now, articles)

    if pair:
        base, quote = (pair.split("/") + [""])[:2]
        articles = [
            a for a in articles
            if base.upper() in a.get("headline", "").upper()
            or quote.upper() in a.get("headline", "").upper()
        ]

    return articles[:20]
