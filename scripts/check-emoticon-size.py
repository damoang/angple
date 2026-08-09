#!/usr/bin/env python3
"""
이모티콘 크기 가드 (B안).

이모티콘은 런타임 업로드가 아니라 git 으로 큐레이션되므로, 업로드 상한 대신
"PR 에서 추가·변경된 이모티콘이 너무 크면 CI 실패"로 막는다. 6.7MB 애니 GIF 가
또 들어오는 걸 방지한다(렌더 느림의 근본 원인).

- 기존 대형 파일은 건드리지 않는다 — PR diff 로 **변경된 파일만** 검사한다.
- GIF 는 애니라 조금 크게(GIF_MAX), 그 외 정지 이미지는 작게(STILL_MAX).
사용: check-emoticon-size.py <base_ref>
"""
import subprocess
import sys
import os

EMO_DIR = "apps/web/static/emoticons"
GIF_MAX = 2 * 1024 * 1024       # 애니 GIF 2MB
STILL_MAX = 512 * 1024          # png/jpg/webp(정지) 512KB


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
        limit = GIF_MAX if ext == "gif" else STILL_MAX
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
