"""In-memory data store for large query results.

Stores full query results by UUID so the frontend can fetch them
without bloating the LLM context window. Includes TTL-based cleanup.
"""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any


class DataStore:
    """Thread-safe in-memory store with TTL expiration."""

    def __init__(self, ttl_seconds: int = 3600):
        self._store: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._ttl = ttl_seconds

    def put(self, data: list[dict], tool_name: str, query: str = None) -> str:
        """Store data and return a UUID key."""
        key = str(uuid.uuid4())
        with self._lock:
            self._store[key] = {
                "data": data,
                "tool_name": tool_name,
                "query": query,
                "created_at": time.time(),
                "record_count": len(data),
            }
        return key

    def get(self, key: str) -> dict[str, Any] | None:
        """Retrieve stored data by key, or None if expired/missing."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            if time.time() - entry["created_at"] > self._ttl:
                del self._store[key]
                return None
            return entry

    def cleanup(self) -> int:
        """Remove expired entries. Returns count of removed items."""
        now = time.time()
        removed = 0
        with self._lock:
            expired = [
                k for k, v in self._store.items()
                if now - v["created_at"] > self._ttl
            ]
            for k in expired:
                del self._store[k]
                removed += 1
        return removed


# Singleton instance
data_store = DataStore()
