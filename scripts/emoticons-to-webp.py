#!/usr/bin/env python3
"""
GIF 이모티콘 → 애니메이션 WebP 변환기.

이모티콘 렌더 느림(A안) 도구. 본문 표시 최대폭은 200px(parser MAX_WIDTH)이라
레티나 2배 400px 를 넘는 원본은 축소하고, gif2webp(libwebp)로 애니 WebP 를 만든다.

⛔ 운영 서버에서 돌리지 않는다 — 재인코딩은 무거운 CPU 작업이라 응답을 악화시킨다.
   GitHub 러너의 emoticons-to-webp.yml workflow_dispatch 로만 실행한다.

동작:
  - {name}.gif 마다 {name}.webp 생성(이미 있으면 건너뜀).
  - WebP 가 원본 GIF 보다 확실히 작을 때만(<= keep-ratio) 채택. 아니면 폐기(그 이모티콘은
    계속 GIF 로 렌더). 작은 GIF 는 WebP 가 더 클 수 있어서다.
  - 채택된 "확장자 제외 이름" 목록을 webp-manifest.names.json 으로 출력 →
    premium plugins/emoticon/lib/webp-manifest.json 의 names 에 반영한다.

--apply 없으면 dry-run(파일을 쓰지 않고 예상 절감만 출력).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

EMO_DIR_DEFAULT = "apps/web/static/emoticons"


def sh(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def gif_dimensions(path):
    from PIL import Image

    with Image.open(path) as im:
        return im.size  # (w, h)


def convert_one(gif_path, out_webp, max_width, quality):
    """gif2webp 로 변환. 필요 시 ImageMagick 으로 먼저 축소. 성공하면 out_webp 생성."""
    src = gif_path
    tmp = None
    try:
        w, _ = gif_dimensions(gif_path)
        if w > max_width:
            tmp = tempfile.NamedTemporaryFile(suffix=".gif", delete=False).name
            # coalesce 로 프레임 합성 후 리사이즈(애니 GIF 안전)
            sh(["convert", gif_path, "-coalesce", "-resize", f"{max_width}x>", tmp])
            src = tmp
        # -mixed: 프레임별 lossy/lossless 자동, -m 6: 최대 압축 노력
        sh(["gif2webp", "-q", str(quality), "-m", "6", "-mixed", src, "-o", out_webp])
        return True
    except subprocess.CalledProcessError as e:
        sys.stderr.write(f"[warn] 변환 실패 {gif_path}: {e.stderr[:200]}\n")
        return False
    finally:
        if tmp and os.path.exists(tmp):
            os.unlink(tmp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir", nargs="?", default=EMO_DIR_DEFAULT)
    ap.add_argument("--max-width", type=int, default=400)
    ap.add_argument("--quality", type=int, default=70)
    ap.add_argument("--min-bytes", type=int, default=102400,
                    help="이 크기 미만 GIF 는 변환 시도 안 함(작은 건 이득 적음)")
    ap.add_argument("--keep-ratio", type=float, default=0.9,
                    help="webp/gif 크기 비가 이 값 이하일 때만 채택")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    if not shutil.which("gif2webp"):
        sys.exit("gif2webp 없음 — webp/libwebp-tools 설치 필요")

    d = args.dir
    gifs = sorted(f for f in os.listdir(d) if f.lower().endswith(".gif"))
    adopted, skipped_small, rejected, failed = [], 0, 0, 0
    before_total = after_total = 0

    for f in gifs:
        gif_path = os.path.join(d, f)
        gsize = os.path.getsize(gif_path)
        if gsize < args.min_bytes:
            skipped_small += 1
            continue
        base = f[: -len(".gif")]
        out = os.path.join(d, base + ".webp")
        with tempfile.TemporaryDirectory() as td:
            tmp_out = os.path.join(td, base + ".webp")
            if not convert_one(gif_path, tmp_out, args.max_width, args.quality):
                failed += 1
                continue
            wsize = os.path.getsize(tmp_out)
            ratio = wsize / gsize if gsize else 1.0
            if ratio > args.keep_ratio:
                rejected += 1
                continue
            adopted.append(base)
            before_total += gsize
            after_total += wsize
            print(f"  {f}: {gsize//1024}KB → {wsize//1024}KB ({ratio*100:.0f}%)")
            if args.apply:
                shutil.copy2(tmp_out, out)

    names_path = os.path.join(d, "..", "webp-manifest.names.json")
    saved_mb = (before_total - after_total) / 1048576
    print("\n=== 요약 ===")
    print(f"GIF {len(gifs)}개 · 채택 {len(adopted)} · 반려(이득없음) {rejected} · "
          f"작아서제외 {skipped_small} · 실패 {failed}")
    print(f"채택분 절감: {before_total//1048576}MB → {after_total//1048576}MB ({saved_mb:.1f}MB)")
    if args.apply:
        with open(names_path, "w") as fp:
            json.dump({"names": adopted}, fp, ensure_ascii=False, indent=2)
        print(f"\n채택 이름 목록 → {names_path}")
        print("⛔ 이 목록을 premium plugins/emoticon/lib/webp-manifest.json 의 names 에 반영하세요.")
    else:
        print("\n(dry-run — 파일 미기록. 실제 반영은 --apply)")


if __name__ == "__main__":
    main()
