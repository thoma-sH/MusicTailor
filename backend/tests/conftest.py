"""Shared pytest fixtures and helpers."""

from __future__ import annotations

from typing import Any

import httpx
import pytest


class ScriptedTransport(httpx.AsyncBaseTransport):
    """Mock transport returning scripted responses in order."""

    def __init__(self, responses: list[httpx.Response | Exception]) -> None:
        self.responses = list(responses)
        self.calls: list[httpx.Request] = []

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        if not self.responses:
            raise AssertionError("transport ran out of scripted responses")
        nxt = self.responses.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        return nxt


class NoNetworkTransport(httpx.AsyncBaseTransport):
    """Asserts no HTTP request is made — for tests that should hit the cache."""

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        raise AssertionError(f"unexpected network call: {request.method} {request.url}")


def make_response(
    status: int,
    body: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        json=body if body is not None else {"ok": True},
        headers=headers or {},
    )


async def _no_sleep(_seconds: float) -> None:
    return None


@pytest.fixture
def disable_sleeps(monkeypatch: pytest.MonkeyPatch) -> None:
    """Skip real backoff sleeps so retry tests run instantly."""
    monkeypatch.setattr("app.providers.base.asyncio.sleep", _no_sleep)
