"""Tests for `app.providers.base`.

Token-bucket math + retry/backoff logic. No real network — see
`tests/conftest.py` for the `ScriptedTransport` helper.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx
import pytest

from app.providers.base import RateLimitedClient, TokenBucket
from tests.conftest import ScriptedTransport, make_response

# -------------------- TokenBucket --------------------


class TestTokenBucket:
    async def test_initial_bucket_is_full(self) -> None:
        bucket = TokenBucket(rate=10.0, capacity=5)
        # Five immediate acquires should not block.
        for _ in range(5):
            await asyncio.wait_for(bucket.acquire(), timeout=0.05)

    async def test_blocks_when_empty_then_refills(self) -> None:
        bucket = TokenBucket(rate=10.0, capacity=1)
        await bucket.acquire()  # consume the only token
        start = time.monotonic()
        await bucket.acquire()  # should wait ~0.1s for refill
        elapsed = time.monotonic() - start
        assert 0.05 < elapsed < 0.25, f"expected ~0.1s wait, got {elapsed:.3f}s"

    async def test_capacity_defaults_to_int_rate(self) -> None:
        bucket = TokenBucket(rate=4.0)
        assert bucket.capacity == 4

    def test_invalid_rate(self) -> None:
        with pytest.raises(ValueError):
            TokenBucket(rate=0)
        with pytest.raises(ValueError):
            TokenBucket(rate=-1)


# -------------------- RateLimitedClient retry/backoff --------------------


def _make_client(transport: ScriptedTransport, **kwargs: Any) -> RateLimitedClient:
    """Build a RateLimitedClient whose internal httpx uses our transport."""
    rl = RateLimitedClient(name="test", base_url="http://test", rps=1000.0, retries=3, **kwargs)
    rl._client = httpx.AsyncClient(base_url="http://test", transport=transport)
    return rl


# Local alias for brevity in this module.
_resp = make_response


async def _no_sleep(_seconds: float) -> None:
    """Drop-in replacement for asyncio.sleep during tests."""
    return None


class TestRateLimitedClient:
    async def test_success_first_try(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr("app.providers.base.asyncio.sleep", _no_sleep)
        transport = ScriptedTransport([_resp(200, {"ok": True})])
        client = _make_client(transport)
        try:
            data = await client.get("/")
            assert data == {"ok": True}
            assert len(transport.calls) == 1
        finally:
            await client.aclose()

    async def test_retries_on_500_then_succeeds(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr("app.providers.base.asyncio.sleep", _no_sleep)
        transport = ScriptedTransport([_resp(503), _resp(503), _resp(200, {"ok": "yes"})])
        client = _make_client(transport)
        try:
            data = await client.get("/")
            assert data == {"ok": "yes"}
            assert len(transport.calls) == 3
        finally:
            await client.aclose()

    async def test_gives_up_after_max_retries(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr("app.providers.base.asyncio.sleep", _no_sleep)
        transport = ScriptedTransport([_resp(500)] * 4)  # 1 + 3 retries
        client = _make_client(transport)
        try:
            with pytest.raises(httpx.HTTPStatusError):
                await client.get("/")
            assert len(transport.calls) == 4
        finally:
            await client.aclose()

    async def test_respects_retry_after_header(self, monkeypatch: pytest.MonkeyPatch) -> None:
        sleeps: list[float] = []

        async def record_sleep(seconds: float) -> None:
            sleeps.append(seconds)

        monkeypatch.setattr("app.providers.base.asyncio.sleep", record_sleep)
        transport = ScriptedTransport([_resp(429, headers={"Retry-After": "3"}), _resp(200)])
        client = _make_client(transport)
        try:
            await client.get("/")
            assert 3.0 in sleeps, f"expected Retry-After=3 honored; got {sleeps}"
        finally:
            await client.aclose()

    async def test_4xx_non_429_is_terminal(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr("app.providers.base.asyncio.sleep", _no_sleep)
        transport = ScriptedTransport([_resp(404)])
        client = _make_client(transport)
        try:
            with pytest.raises(httpx.HTTPStatusError):
                await client.get("/")
            # No retries on 404 — single attempt.
            assert len(transport.calls) == 1
        finally:
            await client.aclose()

    def test_backoff_math(self) -> None:
        client = RateLimitedClient(name="t", base_url="http://x", rps=1.0, max_backoff=8.0)
        try:
            assert client._backoff(0) == 1.0
            assert client._backoff(1) == 2.0
            assert client._backoff(2) == 4.0
            assert client._backoff(3) == 8.0
            assert client._backoff(4) == 8.0  # capped
            assert client._backoff(10) == 8.0  # still capped
        finally:
            asyncio.run(client.aclose())
