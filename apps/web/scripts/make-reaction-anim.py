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
    python3 make-reaction-anim.py --src ... --out ... --check    # 생성 없이 현황만
    python3 make-reaction-anim.py --src ... --out ... --verify   # 산출물 검사(WebP·애니·재생시간)

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

# GIF delay 최소 단위(1/100초). 2cs=20ms 미만은 브라우저가 제각각 보정하므로 내려가지 않는다.
MIN_DELAY_CS = 2

# 아이콘 1개가 이보다 크면 해상도·품질을 낮춰 다시 굽는다.
# 리액션바는 20px 로 그리므로 한 아이콘에 이 이상 쓸 이유가 없다.
# (실측: 이 상한이 없으면 emo-033 54.7KB · emo-045 52.0KB 가 나온다)
SIZE_BUDGET = 40 * 1024
FALLBACK_STEPS = [(160, 62), (128, 56), (96, 50)]


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
    """프레임을 솎되 **총 재생시간을 보존**한다.

    ⛔ 남은 프레임에 `total/n` 을 똑같이 나눠주면 안 된다. 중간 GIF 를 거치는데
       **GIF delay 는 1/100초 단위**라 프레임마다 최대 9ms 가 절삭된다.
       2026-08-18 실측: `emo-033` 800ms/40f → 27ms×30 을 주었더니 20ms 로 잘려
       600ms(-25%) 가 됐다. 애니가 눈에 띄게 빨라진다.
    ⭐ 그래서 **10ms 단위로 미리 쪼개고 나머지를 앞쪽 프레임에 1cs 씩 나눠준다.**
       절삭될 소수점이 아예 없으므로 총합이 정확히 보존된다.
    """
    n = len(frames)
    if n <= MAX_FRAMES:
        return frames, durs
    total = sum(durs)
    step = n / MAX_FRAMES
    kept = [frames[int(k * step)] for k in range(MAX_FRAMES)]

    cs_total = max(MAX_FRAMES * MIN_DELAY_CS, round(total / 10))   # centisecond
    base, rem = divmod(cs_total, MAX_FRAMES)
    base = max(base, MIN_DELAY_CS)
    new_durs = [(base + (1 if k < rem else 0)) * 10 for k in range(MAX_FRAMES)]
    return kept, new_durs


def downscale(frames, size, edge=MAX_EDGE):
    w, h = size
    scale = edge / max(w, h)
    if scale >= 1:
        return frames  # ⛔ 확대하지 않는다 — 없는 정보를 만들어내는 것뿐이다
    return [f.resize((max(1, round(f.size[0] * scale)),
                      max(1, round(f.size[1] * scale))), Image.LANCZOS)
            for f in frames]


def build(src: str, dst: str) -> tuple:
    """returns (원본크기, 산출크기, 인코더, 원본프레임, 산출프레임, 장변)"""
    frames0, durs0, size, n0 = load_frames(src)

    last = None
    for edge, quality in FALLBACK_STEPS:
        frames, durs = thin_frames(frames0, durs0)
        frames = downscale(frames, size, edge)
        out_sz, encoder = _encode(frames, durs, dst, quality)
        last = (out_sz, encoder, len(frames), min(max(size), edge))
        if out_sz <= SIZE_BUDGET:
            break
        # 예산 초과 → 다음 단계로. ⛔ "원본이 이미 작으니 소용없다" 며 건너뛰지 마라.
        #    각 단계는 해상도**와** 품질을 같이 낮춘다. 60×60 원본이라 해상도는 그대로여도
        #    품질 인하만으로 줄어든다(이 조기 탈출 때문에 emo-035 가 예산을 넘겼었다).
    out_sz, encoder, nf, edge_used = last
    return os.path.getsize(src), out_sz, encoder, n0, nf, edge_used


def _encode(frames, durs, dst: str, quality: int) -> tuple:
    """WebP 로 굽는다. ⛔ 어떤 경우에도 GIF 를 산출하지 않는다(nosniff)."""
    tmpdir = tempfile.mkdtemp(prefix="reaction-anim-")
    try:
        gif_path = os.path.join(tmpdir, "cand.gif")
        webp_path = os.path.join(tmpdir, "cand.webp")
        frames[0].save(gif_path, save_all=True, append_images=frames[1:],
                       duration=durs, loop=0, disposal=2)
        subprocess.run(["gif2webp", "-quiet", "-lossy", "-q", str(quality),
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
                           quality=quality, method=4, minimize_size=True)
            encoder = "pillow"
        return os.path.getsize(dst), encoder
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def webp_frame_durations(path: str) -> list:
    """애니 WebP 의 프레임별 duration(ms) 을 **ANMF 청크에서 직접** 읽는다.

    ⛔ PIL 로 읽지 마라. `ImageSequence` 로 순회하며 `frame.info["duration"]` 을 보면
       WebP 에서는 값이 나오지 않는다. 흔히 쓰는 `or 80` 폴백을 두면 **폴백값을 합산해놓고
       "재생시간이 바뀌었다" 는 거짓 경보**를 낸다(2026-08-18 에 실제로 6건 오경보를 냈다).
    """
    import struct
    data = open(path, "rb").read()
    i, out = 12, []
    while i + 8 <= len(data):
        fourcc = data[i:i + 4]
        size = struct.unpack("<I", data[i + 4:i + 8])[0]
        body = data[i + 8:i + 8 + size]
        if fourcc == b"ANMF" and len(body) >= 16:
            out.append(int.from_bytes(body[12:15], "little"))
        i += 8 + size + (size & 1)      # 홀수 크기는 패딩 1바이트
    return out


def verify(src_dir: str, out_dir: str) -> int:
    """산출물이 **진짜 WebP 이고, 애니가 살아 있고, 재생시간이 보존됐는지** 검사한다.

    셋 다 조용히 깨질 수 있는 것들이다:
    - 컨테이너가 GIF 로 새면 nosniff 때문에 브라우저가 거부한다
    - 첫 프레임만 남으면 "정지 썸네일" 회귀가 그대로 재발한다
    - 프레임만 솎고 duration 을 안 늘리면 애니가 빨라져 **다른 동작**이 된다
    """
    names = sorted(f for f in os.listdir(src_dir)
                   if f.startswith("damoang-") and f.endswith(".gif"))
    bad = []
    print(f"{'파일':<24}{'원본':>16}{'산출':>16}   판정")
    for n in names:
        src = os.path.join(src_dir, n)
        dst = os.path.join(out_dir, n[:-4] + "_anim.webp")
        if not os.path.exists(dst):
            bad.append((n, "산출물 없음")); print(f"{n:<24}{'':>16}{'':>16}   ⛔ 없음"); continue
        raw = open(dst, "rb").read()
        if not (raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"):
            bad.append((n, "WebP 아님 — nosniff 에 막힌다"))
            print(f"{n:<24}{'':>16}{'':>16}   ⛔ WebP 아님"); continue

        src_im = Image.open(src)
        src_durs = [f.info.get("duration") or 0 for f in ImageSequence.Iterator(src_im)]
        out_durs = webp_frame_durations(dst)
        sn, on = len(src_durs), len(out_durs)
        st, ot = sum(src_durs), sum(out_durs)

        if sn > 1 and on < 2:
            bad.append((n, f"애니 소실 {sn}→{on}")); note = "⛔ 애니 소실"
        elif st and abs(ot - st) / st > 0.10:
            bad.append((n, f"재생시간 {st}→{ot}ms")); note = f"⛔ 재생시간 {abs(ot-st)/st*100:.0f}% 어긋남"
        else:
            note = "✅"
        print(f"{n:<24}{sn:>5}f {st:>7}ms{on:>5}f {ot:>7}ms   {note}")

    print("-" * 66)
    if bad:
        print(f"⛔ 문제 {len(bad)}건 — 배포하지 마라")
        for n, m in bad:
            print(f"   {n}  {m}")
        return 1
    print(f"✅ {len(names)}개 전부 정상 (진짜 WebP · 애니 보존 · 재생시간 오차 10% 이내)")
    print("   ⚠️ 오차는 GIF 가 duration 을 10ms 단위로만 저장하는 데서 오는 반올림이다.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="원본 damoang-*.gif 가 있는 디렉토리")
    ap.add_argument("--out", required=True, help="_anim.webp 를 쓸 디렉토리")
    ap.add_argument("--check", action="store_true", help="생성하지 않고 현황만 본다")
    ap.add_argument("--verify", action="store_true",
                    help="산출물 검사: 진짜 WebP 인가·애니가 살아있나·재생시간이 보존됐나")
    a = ap.parse_args()

    if a.verify:
        return verify(a.src, a.out)

    if not a.check and not shutil.which("gif2webp"):
        sys.exit("gif2webp 가 없다: sudo dnf install -y libwebp-tools")

    names = sorted(f for f in os.listdir(a.src)
                   if f.startswith("damoang-") and f.endswith(".gif"))
    if not names:
        sys.exit(f"원본이 없다: {a.src}/damoang-*.gif")
    os.makedirs(a.out, exist_ok=True)

    tot_in = tot_out = 0
    made = failed = 0
    print(f"{'파일':<24}{'원본':>9}{'산출':>9}{'인코더':>10}{'프레임':>8}{'장변':>8}")
    for n in names:
        src = os.path.join(a.src, n)
        dst = os.path.join(a.out, n[:-4] + "_anim.webp")
        if a.check:
            state = "있음" if os.path.exists(dst) else "없음"
            print(f"{n:<24}{os.path.getsize(src):>9,}{'':>9}{'':>9}{state:>10}")
            continue
        try:
            si, so, enc, n0, n1, ed = build(src, dst)
        except Exception as e:                       # noqa: BLE001
            print(f"{n:<24}{'':>9}{'':>9}  ⛔ {type(e).__name__}: {e}")
            failed += 1
            continue
        tot_in += si
        tot_out += so
        made += 1
        frame_note = f"{n0}" if n0 == n1 else f"{n0}→{n1}"
        over = " ⚠️예산초과" if so > SIZE_BUDGET else ""
        print(f"{n:<24}{si:>9,}{so:>9,}{enc:>10}{frame_note:>8}{ed:>6}px{over}")

    if a.check:
        return 0
    print("-" * 62)
    # ⛔ 삼항을 f-string 전체에 걸지 마라 — 조건이 거짓이면 합계 줄이 통째로 사라진다.
    ratio = f"   {tot_in / tot_out:.1f}배 절감" if tot_out else ""
    print(f"{'합계':<24}{tot_in:>9,}{tot_out:>9,}{ratio}")
    print(f"\n생성 {made}개 · 실패 {failed}개")
    if failed:
        print("⛔ 실패가 있다 — 전부 성공할 때까지 배포하지 마라(부분 배포 = 일부 아이콘 404)")
        return 1
    print("\n다음: 호스트에 동기화 → 44개 전부 200 확인 → 그 다음에 코드 머지")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
