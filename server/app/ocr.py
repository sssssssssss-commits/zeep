"""Screenshot OCR + 12306-ish field extraction.

ponytail: PaddleOCR is optional/heavy. Default path uses regex on provided text
or a lightweight Pillow+empty stub so the human-confirm UI always works.
Upgrade: pip install paddlepaddle paddleocr and set OCR_ENGINE=paddle.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

# G/D/C/Z/T/K + digits; also allow lowercase OCR noise
TRAIN_RE = re.compile(r"\b([GDCZTK]\s?\d{1,4})\b", re.I)
DATE_RE = re.compile(
    r"(20\d{2})[年\-/.](\d{1,2})[月\-/.](\d{1,2})日?"
)
TIME_RE = re.compile(r"\b([01]?\d|2[0-3])[:：]([0-5]\d)\b")
GATE_RE = re.compile(r"检票口[:：\s]*([A-Za-z0-9\-]+)")
CAR_SEAT_RE = re.compile(
    r"(\d{1,2})\s*车\s*([A-Za-z0-9]+)\s*号?"
)
# "北京南" -> "上海虹桥" style; keep short CJK station names
STATION_ARROW_RE = re.compile(
    r"([\u4e00-\u9fff]{2,10})\s*[→\-—至到]+\s*([\u4e00-\u9fff]{2,10})"
)


def _norm_train(raw: str) -> str:
    return re.sub(r"\s+", "", raw).upper()


def parse_ticket_text(text: str) -> dict[str, str]:
    """Extract minimal trip fields from OCR / pasted text."""
    fields = {
        "train_no": "",
        "date": "",
        "from_station": "",
        "to_station": "",
        "depart_time": "",
        "arrive_time": "",
        "gate": "",
        "carriage": "",
        "seat": "",
    }
    if not text:
        return fields

    m = TRAIN_RE.search(text)
    if m:
        fields["train_no"] = _norm_train(m.group(1))

    m = DATE_RE.search(text)
    if m:
        y, mo, d = m.group(1), int(m.group(2)), int(m.group(3))
        fields["date"] = f"{y}-{mo:02d}-{d:02d}"

    times = TIME_RE.findall(text)
    if times:
        fields["depart_time"] = f"{int(times[0][0]):02d}:{times[0][1]}"
        if len(times) > 1:
            fields["arrive_time"] = f"{int(times[1][0]):02d}:{times[1][1]}"

    m = GATE_RE.search(text)
    if m:
        fields["gate"] = m.group(1)

    m = CAR_SEAT_RE.search(text)
    if m:
        fields["carriage"] = m.group(1).zfill(2)
        fields["seat"] = m.group(2).upper()

    m = STATION_ARROW_RE.search(text)
    if m:
        fields["from_station"] = m.group(1)
        fields["to_station"] = m.group(2)

    return fields


_paddle = None


def _get_paddle():
    global _paddle
    if _paddle is not None:
        return _paddle
    try:
        from paddleocr import PaddleOCR  # type: ignore

        _paddle = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
    except Exception:
        _paddle = False
    return _paddle


def ocr_image(path: Path) -> tuple[str, str]:
    """Return (raw_text, engine_name). Never keeps the image open after return."""
    engine = os.environ.get("OCR_ENGINE", "auto").lower()
    if engine == "mock" or os.environ.get("OCR_MOCK") == "1":
        return "", "mock"

    if engine in ("auto", "paddle"):
        ocr = _get_paddle()
        if ocr:
            result = ocr.ocr(str(path), cls=True)
            lines: list[str] = []
            if result and result[0]:
                for line in result[0]:
                    if line and len(line) >= 2:
                        lines.append(str(line[1][0]))
            return "\n".join(lines), "paddle"

    # ponytail: no OCR runtime — empty text; user fills fields in web UI
    return "", "none"


def recognize(path: Path) -> dict[str, Any]:
    text, engine = ocr_image(path)
    fields = parse_ticket_text(text)
    return {"engine": engine, "raw_text": text, "fields": fields}
