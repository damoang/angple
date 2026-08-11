#!/usr/bin/env python3
"""
이모티콘 크기 가드 (B안).

이모티콘은 런타임 업로드가 아니라 git 으로 큐레이션되므로, 업로드 상한 대신
"PR 에서 추가·변경된 이모티콘이 너무 크면 CI 실패"로 막는다. 6.7MB 애니 GIF 가
또 들어오는 걸 방지한다(렌더 느림의 근본 원인).

- 기존 대형 파일은 건드리지 않는다 — PR diff 로 **변경된 파일만** 검사한다.
- 애니(GIF·애니 WebP)는 조금 크게(ANIM_MAX), 정지 이미지는 작게(STILL_MAX).

⛔ WebP 를 확장자만 보고 "정지" 로 판정하면 안 된다 — emoticons-to-webp 워크플로가
   만드는 산출물이 바로 **애니 WebP** 라, 그렇게 하면 이 가드가 우리 변환 PR 을
   막아버린다(2026-08-11 실측: 40개 중 5개가 512KB 상한에 걸려 CI 실패).
   RIFF 헤더의 ANIM 청크로 애니 여부를 판별한다(외부 의존 없음).
사용: check-emoticon-size.py <base_ref>
"""
import subprocess
import sys
import os

EMO_DIR = "apps/web/static/emoticons"
ANIM_MAX = 2 * 1024 * 1024      # 애니 GIF / 애니 WebP 2MB
STILL_MAX = 512 * 1024          # png/jpg/webp(정지) 512KB


def is_animated_webp(path):
    """WebP 컨테이너에 ANIM 청크가 있으면 애니메이션.

    확장 WebP 는 `RIFF....WEBPVP8X` 뒤에 ANIM/ANMF 청크가 온다. 파일 앞부분만
    읽으면 충분하고 Pillow 같은 의존성이 필요 없다.
    """
    try:
        with open(path, "rb") as fh:
            head = fh.read(1024)
    except OSError:
        return False
    return head[:4] == b"RIFF" and head[8:12] == b"WEBP" and b"ANIM" in head


def changed_files(base_ref):
    out = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=AM", f"{base_ref}...HEAD", "--", EMO_DIR],
        capture_output=True, text=True, check=True,
    ).stdout
    return [f for f in out.splitlines() if f.strip()]


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
    over = []
    for f in changed_files(base):
        if not os.path.isfile(f):
            continue
        size = os.path.getsize(f)
        ext = f.rsplit(".", 1)[-1].lower()
        animated = ext == "gif" or (ext == "webp" and is_animated_webp(f))
        limit = ANIM_MAX if animated else STILL_MAX
        if size > limit:
            over.append((f, size, limit))
    if over:
        print("❌ 크기 상한 초과 이모티콘 — 최적화(축소/애니 WebP) 후 다시 올려주세요:")
        for f, s, lim in over:
            print(f"  {f}: {s//1024}KB (상한 {lim//1024}KB)")
        print("\n대형 애니 GIF 는 emoticons-to-webp 워크플로로 애니 WebP 변환 권장.")
        sys.exit(1)
    print("✅ 변경된 이모티콘 크기 상한 이내")


if __name__ == "__main__":
    main()
