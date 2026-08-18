#!/usr/bin/env python3
"""리액션 아이콘의 **애니메이션 파생본**(`damoang-<id>_anim.webp`)을 만든다.

## 왜 있는가
2026-08-17 에 리액션 아이콘을 정지 `_thumb.webp` 로 바꿔 용량을 96% 줄였는데,
**애니메이션이 사라져 사용자 제보가 들어왔다**(박수 `emo-014` — 가장 많이 쓰이는 반응).
당시 "20px 에서 애니메이션 인지가 거의 없다" 고 단정했지만 측정한 값이 아니었고, 틀렸다.

이 스크립트는 애니메이션을 유지하면서 원본보다도 작은 파생본을 만든다.
`_thumb.webp`(정지)는 **지우지 않는다** — 피커 그리드와 모션 최소화 경로가 계속 쓴다.

## 산출물이 두 곳에서 쓰인다
| 표면 | 파일 | 이유 |
|---|---|---|
| 리액션 바 (20px) | `_anim.webp` | 실제로 달린 반응만 그린다(평균 1.28개) — 애니 비용이 작다 |
| 피커 그리드 (28px) | `_thumb.webp` | 44개를 한 번에 그린다 — 정지가 맞다 |
| 피커 호버 (112px) | `_anim.webp` | 확대 미리보기. 1개씩 요청되므로 on-demand |

## 인코딩 규칙 (실측으로 정한 값)
- **장변 최대 160px.** 원본이 그보다 작으면 **확대하지 않는다**(44개 중 28개가 이미 60×60).
  호버가 112px 로 키우므로 160px 면 충분하고, 그 이상은 바에서 낭비다.
- **프레임 최대 30, 총 재생시간 보존.** ⛔ 프레임만 솎고 duration 을 그대로 두면
  애니가 빨라져 **다른 동작이 된다**. 남은 프레임에 시간을 다시 나눠준다.
  (`emo-043` 은 116프레임이었다 — 112px 미리보기에 그만한 프레임은 의미가 없다)
- **컨테이너는 반드시 WebP.** ⛔ 확장자만 `.webp` 로 두고 내용을 GIF 로 넣지 마라.
  이 경로의 nginx 가 `X-Content-Type-Options: nosniff` 를 붙인다
  (`/etc/nginx/conf.d/damoang.net.conf` → `alias /home/damoang/legacy-data/emoticons/`).
  확장자에서 나온 `image/webp` 와 실제 내용이 어긋나면 브라우저가 거부할 수 있다.
  GIF 가 더 작은 파일이 7개 있지만 손해는 최대 +5.9KB 라 **정합성이 이긴다**.

## 사용
    python3 make-reaction-anim.py --src <원본디렉토리> --out <출력디렉토리>
    python3 make-reaction-anim.py --src ... --out ... --check   # 생성 없이 현황만

⛔ 만든 파일을 **호스트에 먼저 동기화한 뒤** 코드를 머지한다.
   2026-08-11 에 코드를 먼저 내보내 전 파일 404 를 낸 전례가 있다.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile

try:
    from PIL import Image, ImageSequence
except ImportError:
    sys.exit("Pillow 가 필요하다: pip install Pillow")

MAX_EDGE = 160
MAX_FRAMES = 30
WEBP_QUALITY = 62


def load_frames(path: str):
    """(frames, durations, orig_size, orig_frame_count) — 원본 형식은 GIF/WebP 둘 다 온다."""
    im = Image.open(path)
    frames, durs = [], []
    for fr in ImageSequence.Iterator(im):
        frames.append(fr.convert("RGBA"))
        # duration 0 은 브라우저가 100ms 로 보정한다. 여기서도 최소값을 준다.
        durs.append(fr.info.get("duration") or 80)
    return frames, durs, im.size, len(frames)


def thin_frames(frames, durs):
    """프레임을 솎되 **총 재생시간을 보존**한다."""
    n = len(frames)
    if n <= MAX_FRAMES:
        return frames, durs
    total = sum(durs)
    step = n / MAX_FRAMES
    kept = [frames[int(k * step)] for k in range(MAX_FRAMES)]
    return kept, [max(20, round(total / MAX_FRAMES))] * MAX_FRAMES


def downscale(frames, size):
    w, h = size
    scale = MAX_EDGE / max(w, h)
    if scale >= 1:
        return frames  # ⛔ 확대하지 않는다 — 없는 정보를 만들어내는 것뿐이다
    return [f.resize((max(1, round(f.size[0] * scale)),
                      max(1, round(f.size[1] * scale))), Image.LANCZOS)
            for f in frames]


def build(src: str, dst: str) -> tuple:
    """returns (원본크기, 산출크기, 컨테이너, 원본프레임, 산출프레임)"""
    frames, durs, size, n0 = load_frames(src)
    frames, durs = thin_frames(frames, durs)
    frames = downscale(frames, size)

    tmpdir = tempfile.mkdtemp(prefix="reaction-anim-")
    try:
        gif_path = os.path.join(tmpdir, "cand.gif")
        webp_path = os.path.join(tmpdir, "cand.webp")
        frames[0].save(gif_path, save_all=True, append_images=frames[1:],
                       duration=durs, loop=0, disposal=2)
        subprocess.run(["gif2webp", "-quiet", "-lossy", "-q", str(WEBP_QUALITY),
                        "-m", "6", gif_path, "-o", webp_path],
                       capture_output=True, check=False)

        # ⛔ gif2webp 는 입력이 진짜 GIF 일 때만 동작한다. 원본이 이미 WebP 인 것이 섞여 있어
        #    (emo-027·emo-028 은 확장자만 .gif 다) 여기서 조용히 실패한 적이 있다.
        #    실패하면 Pillow 로 직접 WebP 를 쓴다 — **GIF 로 폴백하지 않는다**(nosniff).
        if os.path.exists(webp_path) and os.path.getsize(webp_path) > 0:
            shutil.copyfile(webp_path, dst)
            encoder = "gif2webp"
        else:
            frames[0].save(dst, format="WEBP", save_all=True,
                           append_images=frames[1:], duration=durs, loop=0,
                           quality=WEBP_QUALITY, method=4, minimize_size=True)
            encoder = "pillow"
        out_sz = os.path.getsize(dst)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
    return os.path.getsize(src), out_sz, encoder, n0, len(frames)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="원본 damoang-*.gif 가 있는 디렉토리")
    ap.add_argument("--out", required=True, help="_anim.webp 를 쓸 디렉토리")
    ap.add_argument("--check", action="store_true", help="생성하지 않고 현황만 본다")
    a = ap.parse_args()

    if not a.check and not shutil.which("gif2webp"):
        sys.exit("gif2webp 가 없다: sudo dnf install -y libwebp-tools")

    names = sorted(f for f in os.listdir(a.src)
                   if f.startswith("damoang-") and f.endswith(".gif"))
    if not names:
        sys.exit(f"원본이 없다: {a.src}/damoang-*.gif")
    os.makedirs(a.out, exist_ok=True)

    tot_in = tot_out = 0
    made = skipped = failed = 0
    print(f"{'파일':<24}{'원본':>9}{'산출':>9}{'인코더':>10}{'프레임':>10}")
    for n in names:
        src = os.path.join(a.src, n)
        dst = os.path.join(a.out, n[:-4] + "_anim.webp")
        if a.check:
            state = "있음" if os.path.exists(dst) else "없음"
            print(f"{n:<24}{os.path.getsize(src):>9,}{'':>9}{'':>9}{state:>10}")
            continue
        try:
            si, so, enc, n0, n1 = build(src, dst)
        except Exception as e:                       # noqa: BLE001
            print(f"{n:<24}{'':>9}{'':>9}  ⛔ {type(e).__name__}: {e}")
            failed += 1
            continue
        tot_in += si
        tot_out += so
        made += 1
        frame_note = f"{n0}" if n0 == n1 else f"{n0}→{n1}"
        print(f"{n:<24}{si:>9,}{so:>9,}{enc:>10}{frame_note:>10}")

    if a.check:
        return 0
    print("-" * 62)
    print(f"{'합계':<24}{tot_in:>9,}{tot_out:>9,}"
          f"   {tot_in / tot_out:.1f}배 절감" if tot_out else "")
    print(f"\n생성 {made}개 · 실패 {failed}개 · 건너뜀 {skipped}개")
    if failed:
        print("⛔ 실패가 있다 — 전부 성공할 때까지 배포하지 마라(부분 배포 = 일부 아이콘 404)")
        return 1
    print("\n다음: 호스트에 동기화 → 44개 전부 200 확인 → 그 다음에 코드 머지")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
