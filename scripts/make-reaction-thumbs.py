#!/usr/bin/env python3
"""리액션 앙티콘 중 _thumb.webp 가 없는 것들의 정지 썸네일을 만든다.

## 왜 필요한가
리액션바(reaction-bar)는 앙티콘 원본 GIF 를 그대로 받아 20x20 에 그린다.
`damoang-emo-039.gif` 는 152,924B 인데 같은 파일의 `_thumb.webp` 는 1,142B 다(134배).
썸네일이 있는 것은 전환만 하면 되지만, 6개는 썸네일 자체가 없어 먼저 만들어야 한다.
⛔ 파일 없이 코드부터 바꾸면 그 6개가 404 로 깨진다.

## 규격 (기존 damoang-emo 팩 실측 기준)
- **첫 프레임만** (정지). `_thumb` 은 크기 축소가 아니라 프레임 축소가 본질이다.
- 장변 60px, **비율 유지**. 같은 팩 기존 썸네일이 60x60 이고, 원본이 비정사각이면
  비율을 지킨다(리액션바가 `object-scale-down` 이라 왜곡 없이 들어간다).
- WEBP, quality 82 (기존 썸네일 500~1100B 대와 맞춘다)

사용:
  python3 make_reaction_thumbs.py <static/emoticons 경로>            # dry-run
  python3 make_reaction_thumbs.py <static/emoticons 경로> --apply    # 생성
"""
from __future__ import annotations  # 이 서버 python 은 3.9 라 `str | None` 이 런타임에 깨진다

import os
import sys
from typing import Optional, Tuple

from PIL import Image

# 실측으로 확인된, 리액션에 쓰이는데 _thumb 이 없는 앙티콘
TARGETS = ["emo-001", "emo-007", "emo-042", "emo-043", "emo-045", "emo-046"]
MAX_EDGE = 60
QUALITY = 82


def pick_source(d: str, ident: str) -> Optional[str]:
    """원본 후보 중 하나를 고른다. gif 를 우선하되 없으면 webp/png."""
    for ext in (".gif", ".webp", ".png"):
        p = os.path.join(d, f"damoang-{ident}{ext}")
        if os.path.exists(p):
            return p
    return None


def make_thumb(src: str, dst: str, apply: bool) -> Tuple[int, int, str]:
    im = Image.open(src)
    im.seek(0)  # 첫 프레임
    frame = im.convert("RGBA")
    w, h = frame.size
    if max(w, h) > MAX_EDGE:
        scale = MAX_EDGE / max(w, h)
        frame = frame.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    before = os.path.getsize(src)
    if apply:
        frame.save(dst, format="WEBP", quality=QUALITY, method=6)
        after = os.path.getsize(dst)
    else:
        import io

        buf = io.BytesIO()
        frame.save(buf, format="WEBP", quality=QUALITY, method=6)
        after = buf.tell()
    return before, after, f"{frame.size[0]}x{frame.size[1]}"


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    d = sys.argv[1]
    apply = "--apply" in sys.argv
    if not os.path.isdir(d):
        print(f"⛔ 디렉토리 없음: {d}")
        return 1

    print(f"{'적용' if apply else 'dry-run'} · 대상 {len(TARGETS)}개 · {d}\n")
    tot_b = tot_a = 0
    made = 0
    for ident in TARGETS:
        dst = os.path.join(d, f"damoang-{ident}_thumb.webp")
        if os.path.exists(dst):
            print(f"  건너뜀(이미 있음): damoang-{ident}_thumb.webp")
            continue
        src = pick_source(d, ident)
        if not src:
            print(f"  ⛔ 원본 없음: damoang-{ident}")
            continue
        b, a, size = make_thumb(src, dst, apply)
        tot_b += b
        tot_a += a
        made += 1
        print(f"  damoang-{ident:8} {os.path.basename(src):26} {b/1024:8.1f}KB → {a/1024:6.2f}KB  {size}")

    if made:
        print(f"\n  합계 {tot_b/1024:.0f}KB → {tot_a/1024:.1f}KB  ({100*(1-tot_a/tot_b):.1f}% 감소)")
    if not apply:
        print("\n  반영하려면 --apply")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
