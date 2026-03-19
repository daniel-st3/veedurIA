"""
Token-bucket rate limiter for VeedurIA external API clients and scrapers.

Usage:
    from src.utils.rate_limiter import get_secop_limiter

    limiter = get_secop_limiter()
    limiter.acquire()   # blocks until a token is available
    # ... make request ...
"""

from __future__ import annotations

import threading
import time


class TokenBucketRateLimiter:
    """
    Thread-safe token bucket rate limiter.

    Tokens are added at `rate` per second up to `capacity`. Each call to
    `acquire()` consumes one token, blocking if the bucket is empty.

    Args:
        rate:     Tokens added per second (e.g. 0.5 = one token every 2s).
        capacity: Maximum tokens that can accumulate (burst size).
    """

    def __init__(self, rate: float, capacity: float) -> None:
        self._rate = rate
        self._capacity = capacity
        self._tokens = capacity
        self._last_refill = time.monotonic()
        self._lock = threading.Lock()

    def acquire(self) -> None:
        """Block until a token is available, then consume it."""
        while True:
            with self._lock:
                now = time.monotonic()
                elapsed = now - self._last_refill
                self._tokens = min(
                    self._capacity,
                    self._tokens + elapsed * self._rate,
                )
                self._last_refill = now
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return
                # Calculate how long until the next token arrives
                wait = (1.0 - self._tokens) / self._rate
            time.sleep(wait)


def get_secop_limiter() -> TokenBucketRateLimiter:
    """
    Rate limiter for datos.gov.co SODA API calls.

    0.5 req/s sustained (one request every 2 seconds), burst up to 5.
    With an App Token the API allows 1,000 req/hour; this stays well below that.
    """
    return TokenBucketRateLimiter(rate=0.5, capacity=5)


def get_scraper_limiter() -> TokenBucketRateLimiter:
    """
    Rate limiter for the Cuentas Claras web scraper.

    0.2 req/s (one request every 5 seconds), burst=1 (no burst allowed).
    Matches the etl-rules.md Section 9 constraint of max 1 req/5s.
    """
    return TokenBucketRateLimiter(rate=0.2, capacity=1)
