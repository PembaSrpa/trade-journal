import time

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.config import settings
from app.security import get_current_user_id


def make_creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def sign(claims: dict, secret: str = None) -> str:
    return jwt.encode(claims, secret or settings.supabase_jwt_secret, algorithm="HS256")


def test_valid_hs256_token_extracts_user_id():
    token = sign({"sub": "user-abc", "aud": "authenticated", "exp": int(time.time()) + 3600})
    user_id = get_current_user_id(make_creds(token))
    assert user_id == "user-abc"


def test_expired_hs256_token_rejected():
    token = sign({"sub": "user-abc", "aud": "authenticated", "exp": int(time.time()) - 10})
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_id(make_creds(token))
    assert exc_info.value.status_code == 401


def test_wrong_secret_rejected():
    token = sign(
        {"sub": "user-abc", "aud": "authenticated", "exp": int(time.time()) + 3600},
        secret="a-completely-different-secret-value",
    )
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_id(make_creds(token))
    assert exc_info.value.status_code == 401


def test_garbage_token_rejected():
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_id(make_creds("not.a.real.jwt"))
    assert exc_info.value.status_code == 401


def test_missing_sub_claim_rejected():
    token = sign({"aud": "authenticated", "exp": int(time.time()) + 3600})
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_id(make_creds(token))
    assert exc_info.value.status_code == 401


def test_wrong_audience_rejected():
    token = sign({"sub": "user-abc", "aud": "some-other-audience", "exp": int(time.time()) + 3600})
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_id(make_creds(token))
    assert exc_info.value.status_code == 401
