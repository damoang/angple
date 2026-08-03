#!/usr/bin/env python3
"""이모티콘 용량 최적화 — 해상도만 줄이고 **애니메이션은 보존**한다.

⛔ 운영 서버에서 실행하지 말 것. 무거운 CPU 작업이라 응답시간을 악화시킨다.
   CI 러너에서 돌린다(.github/workflows/optimize-emoticons.yml).

## 왜 해상도인가 (2026-08-03 실측)

이모티콘은 본문에서 **최대 200px**(`parser.ts` 의 `MAX_WIDTH`), 기본 50px 로 표시된다.
선택창은 32~40px 다. 그런데 원본은 640×473, 631×925 처럼 크다 — 표시 대비 최대 13배.

→ 레티나 2배를 감안해도 **400px 면 충분하다.** 그 이상은 내려보내도 화면에 안 보인다.
→ 프레임(애니메이션)은 건드리지 않는다. 움직임이 이모티콘의 본질이다.

## 안전장치

- 원본보다 **커지면 되돌린다**(작아질 때만 채택)
- 저장 후 **다시 열어 프레임 수·크기를 검증**한다. 하나라도 어긋나면 되돌린다
- 파일명·확장자·포맷 **불변**. 기존 글 참조가 깨지지 않는다
- 임계값 미만(작은 파일)은 손대지 않는다 — 835개는 이미 20KB 미만이다
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile

from PIL import Image, ImageSequence

# 본문 최대 표시 200px × 레티나 2배. 이보다 크면 화면에서 차이가 안 보인다.
TARGET_MAX_W = 400
# 이 크기 미만은 건드리지 않는다. 줄여봐야 얻는 게 없고 위험만 생긴다.
MIN_BYTES = 100 * 1024


def load_frames(im: Image.Image) -> list[Image.Image]:
    return [f.copy() for f in ImageSequence.Iterator(im)]


def resize_animated(path: str, target_w: int) -> tuple[int, int, str] | None:
    """축소본을 임시파일로 만든다. 이득이 없거나 검증 실패면 None."""
    before = os.path.getsize(path)
    with Image.open(path) as im:
        fmt = im.format or ""
        w, h = im.size
        n_frames = getattr(im, "n_frames", 1)
        if w <= target_w:
            return None  # 이미 충분히 작다
        ratio = target_w / w
        new_size = (target_w, max(1, round(h * ratio)))
        frames = load_frames(im)
        durations = [f.info.get("duration", im.info.get("duration", 100)) for f in frames]
        loop = im.info.get("loop", 0)

    resized = [f.convert("RGBA").resize(new_size, Image.LANCZOS) for f in frames]

    fd, tmp = tempfile.mkstemp(suffix=os.path.splitext(path)[1])
    os.close(fd)
    try:
        if fmt == "WEBP":
            resized[0].save(tmp, format="WEBP", save_all=len(resized) > 1,
                            append_images=resized[1:], duration=durations, loop=loop,
                            quality=80, method=4)
        elif fmt == "GIF":
            pal = [f.convert("P", palette=Image.ADAPTIVE, colors=256) for f in resized]
            pal[0].save(tmp, format="GIF", save_all=len(pal) > 1, append_images=pal[1:],
                        duration=durations, loop=loop, optimize=True, disposal=2)
        else:
            resized[0].save(tmp, format=fmt)
    except Exception as e:  # noqa: BLE001
        os.unlink(tmp)
        print(f"  ⚠️  {os.path.basename(path)}: 변환 실패 — {str(e)[:70]}")
        return None

    after = os.path.getsize(tmp)

    # ── 검증: 다시 열어 프레임 수와 크기를 확인한다 ──────────────────────
    try:
        with Image.open(tmp) as chk:
            if chk.size != new_size:
                raise ValueError(f"크기 불일치 {chk.size} != {new_size}")
            got = getattr(chk, "n_frames", 1)
            if got != n_frames:
                raise ValueError(f"프레임 손실 {got} != {n_frames}")
    except Exception as e:  # noqa: BLE001
        os.unlink(tmp)
        print(f"  ⚠️  {os.path.basename(path)}: 검증 실패 — {str(e)[:70]} (원본 유지)")
        return None

    if after >= before:
        os.unlink(tmp)
        return None  # 이득 없음

    return before, after, tmp


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("dir", help="이모티콘 디렉터리")
    ap.add_argument("--apply", action="store_true", help="실제로 덮어쓴다 (미지정 시 dry-run)")
    ap.add_argument("--max-width", type=int, default=TARGET_MAX_W)
    ap.add_argument("--min-bytes", type=int, default=MIN_BYTES)
    a = ap.parse_args()

    files = sorted(
        f for f in os.listdir(a.dir)
        if os.path.isfile(os.path.join(a.dir, f))
        and f.lower().endswith((".webp", ".gif", ".png"))
    )
    total_before = total_after = 0
    changed = skipped = failed = 0

    print(f"대상 디렉터리: {a.dir}")
    print(f"목표 최대 폭 {a.max_width}px / 최소 크기 {a.min_bytes // 1024}KB / "
          f"{'적용' if a.apply else 'DRY-RUN'}\n")

    for name in files:
        path = os.path.join(a.dir, name)
        size = os.path.getsize(path)
        if size < a.min_bytes:
            skipped += 1
            continue
        r = resize_animated(path, a.max_width)
        if r is None:
            skipped += 1
            continue
        before, after, tmp = r
        total_before += before
        total_after += after
        changed += 1
        print(f"  {before/1024:>8.0f}KB → {after/1024:>7.0f}KB "
              f"({100*(1-after/before):>4.0f}% 감소)  {name}")
        if a.apply:
            shutil.move(tmp, path)
        else:
            os.unlink(tmp)

    print(f"\n대상 {len(files)}개 중 변경 {changed} / 건너뜀 {skipped} / 실패 {failed}")
    if changed:
        print(f"합계 {total_before/1048576:.1f}MB → {total_after/1048576:.1f}MB "
              f"({100*(1-total_after/total_before):.0f}% 감소, "
              f"{(total_before-total_after)/1048576:.1f}MB 절감)")
    if not a.apply:
        print("\n※ DRY-RUN 이었다. 실제 반영하려면 --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
