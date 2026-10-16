"""Rail ticket sync API + static mobile web host."""
from __future__ import annotations

import os
import secrets
import sqlite3
import string
import tempfile
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

from . import db
from .ocr import recognize

WEB_DIR = Path(__file__).resolve().parent.parent.parent / "web"
TRIP_KEYS = (
    "train_no",
    "date",
    "from_station",
    "to_station",
    "depart_time",
    "arrive_time",
    "gate",
    "carriage",
    "seat",
)

app = FastAPI(title="Rail Sync", version="0.1.0")
# ponytail: per-process limiter is sufficient for the single-process MVP.
# Replace with a shared store before running multiple workers.
_claim_attempts: dict[str, list[float]] = defaultdict(list)


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


def _pair_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


def _token() -> str:
    return secrets.token_urlsafe(24)


class PairCreateOut(BaseModel):
    code: str
    token: str
    expires_at: float


class ClaimIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class ClaimOut(BaseModel):
    token: str


class TripIn(BaseModel):
    train_no: str = Field(default="", max_length=12)
    date: str = Field(default="", max_length=10, pattern=r"^$|^\d{4}-\d{2}-\d{2}$")
    from_station: str = Field(default="", max_length=20)
    to_station: str = Field(default="", max_length=20)
    depart_time: str = Field(default="", max_length=5, pattern=r"^$|^(?:[01]\d|2[0-3]):[0-5]\d$")
    arrive_time: str = Field(default="", max_length=5, pattern=r"^$|^(?:[01]\d|2[0-3]):[0-5]\d$")
    gate: str = Field(default="", max_length=20)
    carriage: str = Field(default="", max_length=8)
    seat: str = Field(default="", max_length=12)


def _auth_token(
    authorization: str | None,
    x_pair_token: str | None,
) -> str:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    elif x_pair_token:
        token = x_pair_token.strip()
    if not token or not db.token_exists(token):
        raise HTTPException(401, "invalid or missing pair token")
    return token


@app.post("/api/pair", response_model=PairCreateOut)
def create_pair(
    authorization: str | None = Header(default=None),
    x_pair_token: str | None = Header(default=None, alias="X-Pair-Token"),
) -> dict[str, Any]:
    """Create a pairing or rotate its short code without orphaning trips."""
    current_token = None
    try:
        current_token = _auth_token(authorization, x_pair_token)
    except HTTPException:
        pass

    for _ in range(10):
        try:
            code = _pair_code()
            if current_token:
                result = db.refresh_pair(current_token, code)
                if result:
                    return result
            return db.create_pair(code, _token())
        except sqlite3.IntegrityError:
            continue
    raise HTTPException(503, "暂时无法生成配对码，请重试")


@app.post("/api/pair/claim", response_model=ClaimOut)
def claim_pair(body: ClaimIn, request: Request) -> dict[str, str]:
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    attempts = [stamp for stamp in _claim_attempts[client] if now - stamp < 300]
    if len(attempts) >= 20:
        raise HTTPException(429, "配对尝试过多，请稍后再试")
    attempts.append(now)
    _claim_attempts[client] = attempts

    token = db.claim_pair(body.code.strip())
    if not token:
        raise HTTPException(400, "配对码无效或已过期")
    _claim_attempts.pop(client, None)
    return {"token": token}


@app.post("/api/ocr")
async def ocr_upload(file: UploadFile = File(...)) -> dict[str, Any]:
    image_suffixes = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    suffix = image_suffixes.get(file.content_type or "")
    if not suffix:
        raise HTTPException(415, "仅支持 JPG、PNG 或 WebP 图片")
    # mkstemp 返回打开的 fd；Windows 上必须先关闭才能删文件
    fd, name = tempfile.mkstemp(suffix=suffix)
    tmp = Path(name)
    try:
        content = await file.read(12 * 1024 * 1024 + 1)
        if len(content) > 12 * 1024 * 1024:
            raise HTTPException(400, "图片过大")
        with os.fdopen(fd, "wb") as out:
            out.write(content)
        fd = -1
        try:
            with Image.open(tmp) as image:
                image.verify()
        except (UnidentifiedImageError, OSError):
            raise HTTPException(400, "文件不是有效图片") from None
        result = recognize(tmp)
        return result
    finally:
        if fd >= 0:
            os.close(fd)
        # 识别完成后删除原图，不长期保存
        tmp.unlink(missing_ok=True)


@app.post("/api/trips")
def confirm_trip(
    body: TripIn,
    authorization: str | None = Header(default=None),
    x_pair_token: str | None = Header(default=None, alias="X-Pair-Token"),
) -> dict[str, Any]:
    token = _auth_token(authorization, x_pair_token)
    payload = {k: (getattr(body, k) or "").strip() for k in TRIP_KEYS}
    if not payload["train_no"] and not payload["from_station"]:
        raise HTTPException(400, "请至少填写车次或车站")
    return db.add_trip(token, payload)


@app.get("/api/trips")
def get_trips(
    authorization: str | None = Header(default=None),
    x_pair_token: str | None = Header(default=None, alias="X-Pair-Token"),
) -> dict[str, Any]:
    token = _auth_token(authorization, x_pair_token)
    # ponytail: cap BLE payload for the MVP; add pagination when multi-trip
    # management enters scope.
    trips = db.list_trips(token)[:10]
    return {"trips": trips, "synced_at": time.time()}


@app.delete("/api/trips")
def delete_trips(
    authorization: str | None = Header(default=None),
    x_pair_token: str | None = Header(default=None, alias="X-Pair-Token"),
) -> dict[str, int]:
    token = _auth_token(authorization, x_pair_token)
    return {"deleted": db.clear_trips(token)}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


if WEB_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")
