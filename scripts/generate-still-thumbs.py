#!/usr/bin/env python3
"""이모티콘 피커용 **정지 썸네일**(`*_still.webp`)을 생성한다.

⛔ 운영 서버에서 실행하지 말 것. CI 러너에서 돌린다
   (.github/workflows/generate-still-thumbs.yml).

## 왜 필요한가 (2026-08-04 실측)

선택창은 썸네일을 40px 로 그리는데, `DINKIssTyle` 팩 썸네일 104개가 **6.22MB** 다.
같은 자리에 쓰이는 `onion` 팩은 264개가 0.41MB — 15배 차이다.

원인은 해상도가 아니라 **프레임 수**다. 128×128 짜리 썸네일에 91~197 프레임이 들어 있다.
그래서 해상도를 줄여도 소용이 없다:

| 방식 | 절감 |
|---|---|
| 80px 로 축소 + q60, 애니 유지 | 27.9% |
| **첫 프레임만 (해상도 유지)** | **98.8%** (213KB → 1.7KB) |

## 무엇을 하는가

`*_thumb.*` 중 **여러 프레임짜리**만 골라 첫 프레임을 `*_still.webp` 로 저장한다.

**기존 파일은 건드리지 않는다 — 추가만 한다.** 피커는 평소 `_still` 을 쓰고
확대(hover) 할 때만 기존 `_thumb`(애니)으로 바꾼다. 되돌리려면 컴포넌트만 되돌리면 되고,
`_still` 파일은 남아 있어도 아무도 참조하지 않으므로 무해하다.

⛔ hover 소스로 **원본 파일을 쓰면 안 된다.** `DINKIssTyle-ang-004.webp` 는 5.7MB 라
   지금보다 나빠진다. 반드시 `_thumb`(평균 60KB)을 쓴다.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile

from PIL import Image

# 썸네일은 최대 40px 로 표시되고 hover 시 3배(120px) 확대된다.
# 원본 썸네일이 보통 128px 이므로 해상도는 그대로 두고 프레임만 버린다.
QUALITY = 80

THUMB_MARK = "_thumb."
STILL_SUFFIX = "_still.webp"


def still_name(thumb_filename: str) -> str:
    """`X_thumb.webp` → `X_still.webp`"""
    base = thumb_filename[: thumb_filename.rindex(THUMB_MARK)]
    return f"{base}{STILL_SUFFIX}"


def make_still(path: str, out_path: str) -> tuple[int, int] | None:
    """첫 프레임만 뽑아 저장한다. 이득이 없거나 검증 실패면 None."""
    before = os.path.getsize(path)
    with Image.open(path) as im:
        if getattr(im, "n_frames", 1) <= 1:
            return None  # 이미 정지 이미지 — 만들어봐야 파일만 는다
        im.seek(0)
        first = im.convert("RGBA")

    fd, tmp = tempfile.mkstemp(suffix=".webp")
    os.close(fd)
    try:
        first.save(tmp, format="WEBP", quality=QUALITY, method=4)
    except Exception as e:  # noqa: BLE001
        os.unlink(tmp)
        print(f"  ⚠️  {os.path.basename(path)}: 변환 실패 — {str(e)[:70]}")
        return None

    after = os.path.getsize(tmp)

    # ── 검증: 다시 열어 정지 이미지인지 확인한다 ────────────────────────
    try:
        with Image.open(tmp) as chk:
            chk.verify()
        with Image.open(tmp) as chk:
            if getattr(chk, "n_frames", 1) != 1:
                raise ValueError("정지 이미지가 아니다")
            if chk.size != first.size:
                raise ValueError(f"크기 불일치 {chk.size} != {first.size}")
    except Exception as e:  # noqa: BLE001
        os.unlink(tmp)
        print(f"  ⚠️  {os.path.basename(path)}: 검증 실패 — {str(e)[:70]}")
        return None

    # 있을 수 없지만, 커지면 만들지 않는다. 만들면 피커가 더 무거워진다.
    if after >= before:
        os.unlink(tmp)
        print(f"  ⚠️  {os.path.basename(path)}: 이득 없음 ({after} >= {before}) — 생략")
        return None

    # ⛔ mkstemp 는 0600 으로 만든다. 그대로 두면 이 스크립트를 호스트 서빙 디렉터리
    #    (/home/damoang/legacy-data/emoticons)에 직접 돌렸을 때 웹서버가 못 읽는다.
    os.chmod(tmp, 0o644)
    os.replace(tmp, out_path)
    return before, after


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("dir", help="이모티콘 디렉터리")
    ap.add_argument("--apply", action="store_true", help="실제로 파일을 만든다 (미지정 시 dry-run)")
    a = ap.parse_args()

    thumbs = sorted(
        f
        for f in os.listdir(a.dir)
        if os.path.isfile(os.path.join(a.dir, f))
        and THUMB_MARK in f
        and f.lower().endswith((".webp", ".gif", ".png"))
    )

    total_before = total_after = 0
    made = skipped = 0

    print(f"대상 디렉터리: {a.dir}")
    print(f"썸네일 {len(thumbs)}개 / {'적용' if a.apply else 'DRY-RUN'}\n")

    for name in thumbs:
        src = os.path.join(a.dir, name)
        dst = os.path.join(a.dir, still_name(name))

        if not a.apply:
            # dry-run 은 임시 위치에 만들어 크기만 재고 지운다
            fd, probe = tempfile.mkstemp(suffix=".webp")
            os.close(fd)
            r = make_still(src, probe)
            if os.path.exists(probe):
                os.unlink(probe)
        else:
            r = make_still(src, dst)

        if r is None:
            skipped += 1
            continue
        before, after = r
        total_before += before
        total_after += after
        made += 1
        if before >= 50 * 1024:  # 큰 것만 개별 출력 — 로그가 길어지면 안 읽는다
            print(
                f"  {before/1024:>8.0f}KB → {after/1024:>7.1f}KB "
                f"({100*(1-after/before):>4.0f}% 감소)  {name}"
            )

    print(f"\n썸네일 {len(thumbs)}개 중 생성 {made} / 건너뜀 {skipped}(이미 정지 이미지)")
    if made:
        print(
            f"피커 로드량 {total_before/1048576:.2f}MB → {total_after/1048576:.2f}MB "
            f"({100*(1-total_after/total_before):.1f}% 감소)"
        )
    if not a.apply:
        print("\n※ DRY-RUN 이었다. 실제로 만들려면 --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
