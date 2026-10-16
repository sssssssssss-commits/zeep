"""Runnable check: ticket text parsing + pair/trip store."""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import db  # noqa: E402
from app.ocr import parse_ticket_text  # noqa: E402


SAMPLE = """
订单号 E123456789
G1234 次
2026年10月20日
北京南 → 上海虹桥
09:00 开 13:28 到
检票口 6A
05车12A号
"""


def test_parse() -> None:
    f = parse_ticket_text(SAMPLE)
    assert f["train_no"] == "G1234", f
    assert f["date"] == "2026-10-20", f
    assert f["from_station"] == "北京南", f
    assert f["to_station"] == "上海虹桥", f
    assert f["depart_time"] == "09:00", f
    assert f["arrive_time"] == "13:28", f
    assert f["gate"] == "6A", f
    assert f["carriage"] == "05", f
    assert f["seat"] == "12A", f


def test_pair_and_trip() -> None:
    temp_dir = tempfile.TemporaryDirectory()
    db.DB_PATH = Path(temp_dir.name) / "rail.db"
    db.init_db()
    pair = db.create_pair("123456", "tok_test_abc")
    assert db.claim_pair("123456") == "tok_test_abc"
    assert db.claim_pair("000000") is None
    trip = db.add_trip(
        pair["token"],
        {
            "train_no": "G1",
            "date": "2026-10-20",
            "from_station": "北京南",
            "to_station": "上海虹桥",
            "depart_time": "09:00",
            "arrive_time": "13:00",
            "gate": "1A",
            "carriage": "02",
            "seat": "01A",
        },
    )
    rotated = db.refresh_pair(pair["token"], "654321")
    assert rotated and rotated["token"] == pair["token"]
    assert db.claim_pair("123456") is None
    assert db.claim_pair("654321") == pair["token"]
    trips = db.list_trips(pair["token"])
    assert any(t["train_no"] == "G1" for t in trips), trips
    assert trip["id"]
    temp_dir.cleanup()


if __name__ == "__main__":
    test_parse()
    test_pair_and_trip()
    print("ok")
