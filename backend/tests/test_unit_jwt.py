"""
Unit tests for JWT token functions (app/auth/jwt.py).

These tests are pure — no database, no HTTP, no fixtures.
They verify the security contract around token creation, decoding, and type isolation.
"""
import time
import pytest
import jwt as pyjwt
from datetime import timedelta

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
)
from app.core.config import settings


class TestCreateAccessToken:
    """create_access_token: short-lived, type='access', carries subject claim."""

    def test_returns_string(self):
        token = create_access_token({"sub": "user-1", "role": "Neuropsicólogo"})
        assert isinstance(token, str)

    def test_payload_contains_sub(self):
        token = create_access_token({"sub": "user-abc"})
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        assert payload["sub"] == "user-abc"

    def test_payload_type_is_access(self):
        token = create_access_token({"sub": "user-1"})
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        assert payload["type"] == "access"

    def test_payload_has_exp(self):
        token = create_access_token({"sub": "user-1"})
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        assert "exp" in payload

    def test_custom_expires_delta_respected(self):
        token = create_access_token({"sub": "u"}, expires_delta=timedelta(hours=1))
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        # exp should be ~3600s from now — within a 30s tolerance
        remaining = payload["exp"] - time.time()
        assert 3570 < remaining < 3630

    def test_expired_token_raises_on_decode(self):
        token = create_access_token({"sub": "u"}, expires_delta=timedelta(seconds=-1))
        with pytest.raises(pyjwt.ExpiredSignatureError):
            pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])

    def test_does_not_contain_jti(self):
        """Access tokens don't use JTI — denylist is for refresh only."""
        token = create_access_token({"sub": "u"})
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        assert "jti" not in payload


class TestCreateRefreshToken:
    """create_refresh_token: long-lived, type='refresh', must carry unique JTI."""

    def test_returns_string(self):
        token = create_refresh_token({"sub": "user-1"})
        assert isinstance(token, str)

    def test_payload_type_is_refresh(self):
        token = create_refresh_token({"sub": "user-1"})
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        assert payload["type"] == "refresh"

    def test_payload_has_jti(self):
        token = create_refresh_token({"sub": "user-1"})
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        assert "jti" in payload
        assert len(payload["jti"]) > 0

    def test_jti_is_unique_per_token(self):
        """Every refresh token must have a different JTI for denylist to work."""
        tokens = [create_refresh_token({"sub": "u"}) for _ in range(10)]
        jtis = [
            pyjwt.decode(t, settings.SECRET_KEY, algorithms=["HS256"])["jti"]
            for t in tokens
        ]
        assert len(set(jtis)) == 10

    def test_payload_has_exp(self):
        token = create_refresh_token({"sub": "u"})
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        assert "exp" in payload

    def test_refresh_token_lives_longer_than_access_token(self):
        access = create_access_token({"sub": "u"})
        refresh = create_refresh_token({"sub": "u"})
        acc_exp = pyjwt.decode(access, settings.SECRET_KEY, algorithms=["HS256"])["exp"]
        ref_exp = pyjwt.decode(refresh, settings.SECRET_KEY, algorithms=["HS256"])["exp"]
        assert ref_exp > acc_exp


class TestDecodeAccessToken:
    """decode_access_token: returns payload for valid access tokens, None otherwise."""

    def test_valid_access_token_returns_payload(self):
        token = create_access_token({"sub": "user-1", "role": "Administrador"})
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user-1"

    def test_expired_token_returns_none(self):
        token = create_access_token({"sub": "u"}, expires_delta=timedelta(seconds=-1))
        assert decode_access_token(token) is None

    def test_tampered_signature_returns_none(self):
        token = create_access_token({"sub": "u"})
        tampered = token[:-5] + "XXXXX"
        assert decode_access_token(tampered) is None

    def test_garbage_string_returns_none(self):
        assert decode_access_token("not.a.token") is None

    def test_empty_string_returns_none(self):
        assert decode_access_token("") is None

    def test_refresh_token_rejected_by_decode_access(self):
        """Type confusion: a refresh token must NOT validate as an access token."""
        refresh = create_refresh_token({"sub": "u"})
        assert decode_access_token(refresh) is None

    def test_wrong_secret_returns_none(self):
        token = pyjwt.encode(
            {"sub": "u", "type": "access"},
            "wrong-secret",
            algorithm="HS256",
        )
        assert decode_access_token(token) is None


class TestDecodeRefreshToken:
    """decode_refresh_token: returns payload for valid refresh tokens, None otherwise."""

    def test_valid_refresh_token_returns_payload(self):
        token = create_refresh_token({"sub": "user-1"})
        payload = decode_refresh_token(token)
        assert payload is not None
        assert payload["sub"] == "user-1"

    def test_payload_includes_jti(self):
        token = create_refresh_token({"sub": "u"})
        payload = decode_refresh_token(token)
        assert payload is not None
        assert "jti" in payload

    def test_expired_token_returns_none(self):
        token = pyjwt.encode(
            {"sub": "u", "type": "refresh", "jti": "abc"},
            settings.SECRET_KEY,
            algorithm="HS256",
        )
        # Manually verify it decodes, then create an actually expired one
        valid_payload = decode_refresh_token(token)
        assert valid_payload is not None
        # Now create an expired one by manipulating exp directly
        expired = pyjwt.encode(
            {"sub": "u", "type": "refresh", "jti": "abc", "exp": int(time.time()) - 1},
            settings.SECRET_KEY,
            algorithm="HS256",
        )
        assert decode_refresh_token(expired) is None

    def test_tampered_signature_returns_none(self):
        token = create_refresh_token({"sub": "u"})
        tampered = token[:-5] + "XXXXX"
        assert decode_refresh_token(tampered) is None

    def test_access_token_rejected_by_decode_refresh(self):
        """Type confusion: an access token must NOT validate as a refresh token."""
        access = create_access_token({"sub": "u"})
        assert decode_refresh_token(access) is None

    def test_garbage_string_returns_none(self):
        assert decode_refresh_token("not.a.token") is None

    def test_empty_string_returns_none(self):
        assert decode_refresh_token("") is None
