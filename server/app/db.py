"""SQLite persistence for pair tokens and confirmed trips."""
from __future__ import annotations

import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "rail.db"


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS pairs (
              code TEXT PRIMARY KEY,
              token TEXT NOT NULL UNIQUE,
              created_at REAL NOT NULL,
              expires_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS trips (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              token TEXT NOT NULL,
              payload TEXT NOT NULL,
              confirmed_at REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_trips_token ON trips(token);
            """
        )


def create_pair(code: str, token: str, ttl_sec: int = 900) -> dict[str, Any]:
    now = time.time()
    expires = now + ttl_sec
    with connect() as conn:
        conn.execute(
            "INSERT INTO pairs(code, token, created_at, expires_at) VALUES (?,?,?,?)",
            (code, token, now, expires),
        )
    return {"code": code, "token": token, "expires_at": expires}


def refresh_pair(token: str, code: str, ttl_sec: int = 900) -> dict[str, Any] | None:
    """Rotate the short code while preserving the token and its trips."""
    now = time.time()
    expires = now + ttl_sec
    with connect() as conn:
        cur = conn.execute(
            "UPDATE pairs SET code = ?, created_at = ?, expires_at = ? WHERE token = ?",
            (code, now, expires, token),
        )
        if cur.rowcount != 1:
            return None
    return {"code": code, "token": token, "expires_at": expires}


def claim_pair(code: str) -> str | None:
    now = time.time()
    with connect() as conn:
        row = conn.execute(
            "SELECT token, expires_at FROM pairs WHERE code = ?", (code,)
        ).fetchone()
        if not row:
            return None
        if row["expires_at"] < now:
            return None
        return row["token"]


def token_exists(token: str) -> bool:
    with connect() as conn:
        row = conn.execute("SELECT 1 FROM pairs WHERE token = ?", (token,)).fetchone()
        return row is not None


def add_trip(token: str, payload: dict[str, Any]) -> dict[str, Any]:
    now = time.time()
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO trips(token, payload, confirmed_at) VALUES (?,?,?)",
            (token, json.dumps(payload, ensure_ascii=False), now),
        )
        trip_id = cur.lastrowid
    return {"id": trip_id, **payload, "confirmed_at": now}


def list_trips(token: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, payload, confirmed_at FROM trips WHERE token = ? ORDER BY confirmed_at DESC",
            (token,),
        ).fetchall()
    out: list[dict[str, Any]] = []
    for row in rows:
        item = json.loads(row["payload"])
        item["id"] = row["id"]
        item["confirmed_at"] = row["confirmed_at"]
        out.append(item)
    return out


def clear_trips(token: str) -> int:
    with connect() as conn:
        cur = conn.execute("DELETE FROM trips WHERE token = ?", (token,))
        return cur.rowcount
