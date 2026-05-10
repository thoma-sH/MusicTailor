"""Generic external-call client with token-bucket rate limiting and retry.

Per-source clients (SpotifyClient, LastFmClient, AcousticBrainzClient,
MusicBrainzClient) wrap `RateLimitedClient` and add their own caching, since
each source has its own cache table and row schema.

Defaults — exponential backoff capped at 8 s, 3 retries — target user-facing
search-box latency: worst-case ~7 s before failure surfaces.
"""

from __future__ import annotations

import asyncio
import time
from types import TracebackType
from typing import Any

import httpx
import structlog

logger = structlog.get_logger()


class TokenBucket:
    """Async-safe token bucket.

    Tokens refill continuously at `rate` per second up to `capacity`.
    `acquire` blocks (off the lock) until a token is available.
    """

    def __init__(self, rate: float, capacity: int | None = None) -> None:
        if rate <= 0:
            raise ValueError("rate must be positive")
        self.rate = rate
        self.capacity = capacity if capacity is not None else max(1, int(rate))
        self.tokens = float(self.capacity)
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            self._refill_locked()
            if self.tokens >= 1.0:
                self.tokens -= 1.0
                return
            wait = (1.0 - self.tokens) / self.rate
            self.tokens = 0.0

        await asyncio.sleep(wait)
        async with self._lock:
            # We slept exactly the right duration; consume the freshly-arrived
            # token. Refill once more in case other coroutines were also
            # waiting and we're racing for it.
            self._refill_locked()
            self.tokens = max(0.0, self.tokens - 1.0)

    def _refill_locked(self) -> None:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_refill = now


class RateLimitedClient:
    """HTTP client with rate limiting and retry on 5xx/429.

    Generic — knows nothing about any specific API's semantics. Returns the
    parsed JSON body on success; raises `httpx.HTTPStatusError` for terminal
    failures.
    """

    def __init__(
        self,
        *,
        name: str,
        base_url: str,
        rps: float,
        timeout: float = 10.0,
        retries: int = 3,
        max_backoff: float = 8.0,
    ) -> None:
        self.name = name
        self.bucket = TokenBucket(rate=rps)
        self.retries = retries
        self.max_backoff = max_backoff
        self._client = httpx.AsyncClient(base_url=base_url, timeout=timeout)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> RateLimitedClient:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.aclose()

    async def get(
        self,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        return await self._request("GET", path, params=params, headers=headers)

    async def post(
        self,
        path: str,
        *,
        data: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        return await self._request("POST", path, data=data, json=json, headers=headers)

    async def _request(
        self,
        method: str,
        path: str,
        **kwargs: Any,
    ) -> Any:
        last_status: int | None = None

        for attempt in range(self.retries + 1):
            await self.bucket.acquire()

            try:
                resp = await self._client.request(method, path, **kwargs)
            except httpx.HTTPError as e:
                if attempt == self.retries:
                    logger.error(
                        "provider.request_failed",
                        provider=self.name,
                        method=method,
                        path=path,
                        attempt=attempt,
                        error=str(e),
                    )
                    raise
                await asyncio.sleep(self._backoff(attempt))
                continue

            last_status = resp.status_code

            if resp.status_code == 429:
                wait = self._retry_after(resp) or self._backoff(attempt)
                logger.warning(
                    "provider.rate_limited",
                    provider=self.name,
                    attempt=attempt,
                    wait=wait,
                )
                if attempt == self.retries:
                    resp.raise_for_status()
                await asyncio.sleep(wait)
                continue

            if 500 <= resp.status_code < 600:
                logger.warning(
                    "provider.server_error",
                    provider=self.name,
                    attempt=attempt,
                    status=resp.status_code,
                )
                if attempt == self.retries:
                    resp.raise_for_status()
                await asyncio.sleep(self._backoff(attempt))
                continue

            resp.raise_for_status()
            return resp.json()

        raise RuntimeError(f"{self.name}: retries exhausted (last status: {last_status})")

    def _backoff(self, attempt: int) -> float:
        return min(self.max_backoff, float(2**attempt))

    @staticmethod
    def _retry_after(resp: httpx.Response) -> float | None:
        ra = resp.headers.get("Retry-After")
        if not ra:
            return None
        try:
            return float(ra)
        except ValueError:
            return None
