#!/usr/bin/env python3
"""Turn characters into stroke-order point lists (JSON) from KanjiVG.

Usage:
  python3 strokes_from_kanjivg.py 永 学 あ --points 24 --out lesson.json
  python3 strokes_from_kanjivg.py --selftest

Output: {"source": ..., "license": ..., "characters": [{"char": "永", "strokes": [[[x, y], ...], ...]}]}
Coordinates are normalized to 0..1 (KanjiVG viewBox is 109 x 109), y grows downward.
Stroke data: KanjiVG (c) Ulrich Apel, CC BY-SA 3.0 (https://kanjivg.tagaini.net/).
"""
import argparse, json, math, re, sys, urllib.request
from pathlib import Path

RAW = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/{:05x}.svg"
CACHE = Path(__file__).resolve().parent / "_kanjivg_cache"
SIZE = 109.0
TOKEN_RE = re.compile(r"[MmCcSsLlZz]|-?\d*\.?\d+(?:e-?\d+)?")


def fetch_svg(ch):
    CACHE.mkdir(exist_ok=True)
    f = CACHE / ("%05x.svg" % ord(ch))
    if not f.exists():
        req = urllib.request.Request(RAW.format(ord(ch)), headers={"User-Agent": "stroke-lesson-builder"})
        f.write_bytes(urllib.request.urlopen(req, timeout=30).read())
    return f.read_text(encoding="utf-8")


def cubic(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1])


def path_to_polyline(d, steps=12):
    toks = TOKEN_RE.findall(d)
    pts, cur, start, last_ctrl, cmd, i = [], (0.0, 0.0), (0.0, 0.0), None, None, 0

    def num():
        nonlocal i
        v = float(toks[i]); i += 1
        return v

    while i < len(toks):
        if re.match(r"[A-Za-z]", toks[i]):
            cmd = toks[i]; i += 1
            if cmd in "Zz":
                pts.append(start); cur = start; continue
        if cmd in "Mm":
            x, y = num(), num()
            cur = (cur[0] + x, cur[1] + y) if cmd == "m" and pts else (x, y)
            start = cur; pts.append(cur); last_ctrl = None
            cmd = "l" if cmd == "m" else "L"
        elif cmd in "Ll":
            x, y = num(), num()
            cur = (cur[0] + x, cur[1] + y) if cmd == "l" else (x, y)
            pts.append(cur); last_ctrl = None
        elif cmd in "Cc":
            v = [num() for _ in range(6)]
            if cmd == "c":
                v = [v[0] + cur[0], v[1] + cur[1], v[2] + cur[0], v[3] + cur[1], v[4] + cur[0], v[5] + cur[1]]
            p1, p2, p3 = (v[0], v[1]), (v[2], v[3]), (v[4], v[5])
            pts += [cubic(cur, p1, p2, p3, k / steps) for k in range(1, steps + 1)]
            last_ctrl, cur = p2, p3
        elif cmd in "Ss":
            v = [num() for _ in range(4)]
            if cmd == "s":
                v = [v[0] + cur[0], v[1] + cur[1], v[2] + cur[0], v[3] + cur[1]]
            p1 = (2 * cur[0] - last_ctrl[0], 2 * cur[1] - last_ctrl[1]) if last_ctrl else cur
            p2, p3 = (v[0], v[1]), (v[2], v[3])
            pts += [cubic(cur, p1, p2, p3, k / steps) for k in range(1, steps + 1)]
            last_ctrl, cur = p2, p3
        else:
            raise ValueError("unsupported path command: %r" % cmd)
    return pts


def resample(pts, n):
    seg = [math.dist(pts[k], pts[k + 1]) for k in range(len(pts) - 1)]
    total = sum(seg) or 1.0
    out, acc, k = [], 0.0, 0
    for j in range(n):
        target = total * j / (n - 1)
        while k < len(seg) - 1 and acc + seg[k] < target:
            acc += seg[k]; k += 1
        t = 0.0 if seg[k] == 0 else (target - acc) / seg[k]
        t = max(0.0, min(1.0, t))
        x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t
        y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t
        out.append([round(x / SIZE, 4), round(y / SIZE, 4)])
    return out


def strokes_for(ch, points):
    svg = fetch_svg(ch)
    paths = re.findall(r'<path[^>]*\sid="kvg:[0-9a-f]+-s(\d+)"[^>]*\sd="([^"]+)"', svg)
    if not paths:  # attribute order may differ
        paths = [(m.group(2), m.group(1)) for m in re.finditer(r'<path[^>]*\sd="([^"]+)"[^>]*\sid="kvg:[0-9a-f]+-s(\d+)"', svg)]
        paths = [(b, a) for a, b in paths]
    paths = sorted(((int(n), d) for n, d in paths), key=lambda x: x[0])
    return [resample(path_to_polyline(d), points) for _, d in paths]


def build(chars, points):
    return {"source": "KanjiVG (https://kanjivg.tagaini.net/)",
            "license": "CC BY-SA 3.0 (c) Ulrich Apel",
            "coordinates": "normalized 0..1, y down, from 109x109 viewBox",
            "characters": [{"char": c, "strokes": strokes_for(c, points)} for c in chars]}


def selftest():
    known = {"永": 5, "学": 8, "あ": 3, "一": 1, "書": 10}
    data = build(list(known), 16)
    bad = 0
    for item in data["characters"]:
        n = len(item["strokes"]); ok = n == known[item["char"]]
        inside = all(0 <= x <= 1 and 0 <= y <= 1 for s in item["strokes"] for x, y in s)
        bad += (not ok) + (not inside)
        print(item["char"], "strokes", n, "expected", known[item["char"]], "OK" if ok and inside else "NG")
    print("selftest", "PASS" if bad == 0 else "FAIL (%d)" % bad)
    return 0 if bad == 0 else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("chars", nargs="*")
    ap.add_argument("--points", type=int, default=24)
    ap.add_argument("--out")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        sys.exit(selftest())
    if not a.chars:
        ap.error("give characters, e.g. 永 学")
    text = json.dumps(build([c for s in a.chars for c in s], a.points), ensure_ascii=False)
    (Path(a.out).write_text(text, encoding="utf-8") if a.out else print(text))
