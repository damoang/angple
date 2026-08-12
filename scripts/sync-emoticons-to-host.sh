#!/bin/bash
#
# 이모티콘을 저장소(SoT) → 운영 서빙 디렉토리로 동기화한다.
#
# ⛔ 왜 이 스크립트가 필요한가
#   이모티콘은 **nginx 가 호스트 파일을 직접 서빙**한다. 컨테이너 이미지에 넣어도 나가지 않는다.
#     /etc/nginx/conf.d/damoang.net.conf
#       location ^~ /emoticons/            alias /home/damoang/legacy-data/emoticons/;
#       location ^~ /api/emoticons/nariya/ alias /home/damoang/legacy-data/emoticons/;  (리액션 피커)
#   저장소 apps/web/static/emoticons 는 SoT 이자 빌드 사본이고, 서빙본은 위 호스트 경로다.
#   2026-08-11: emoticons-to-webp 워크플로 산출물 40개를 머지·승격했는데 운영에서 전부 404 였다.
#   파일이 컨테이너에만 들어갔기 때문이다. 그 간극을 메우는 게 이 스크립트다.
#
# 사용:
#   bash scripts/sync-emoticons-to-host.sh              # dry-run (기본) — 무엇이 바뀔지만 출력
#   sudo bash scripts/sync-emoticons-to-host.sh --apply # 실제 반영 (서빙 디렉토리가 damoang 소유)
#
# 기본은 **추가만** 한다. 기존 파일 내용이 다르면 건드리지 않고 목록만 알린다
# (덮어쓰기는 --overwrite 를 명시할 때만, 항상 백업 후).
set -euo pipefail

DEST="${EMOTICON_DEST:-/home/damoang/legacy-data/emoticons}"
APPLY=0
OVERWRITE=0
for a in "$@"; do
    case "$a" in
        --apply) APPLY=1 ;;
        --overwrite) OVERWRITE=1 ;;
        -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
        *) echo "알 수 없는 인자: $a" >&2; exit 2 ;;
    esac
done

# 저장소 루트는 **스크립트 자신의 위치**에서 찾는다 — 현재 디렉토리 기준으로 찾으면
# 다른 경로에서 sudo 로 부를 때 실패한다(sudo 는 cwd 를 바꾸지 않지만, 사용자가
# 저장소 밖에서 절대경로로 호출하는 게 정상적인 사용 방식이다).
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# root 로 실행하면 다른 소유자의 저장소를 git 이 거부한다(dubious ownership).
git config --global --add safe.directory "$(dirname "$SCRIPT_DIR")" 2>/dev/null || true
ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$ROOT" ]; then
    echo "⛔ 이 스크립트는 web 저장소 안에 있어야 한다 (현재: $SCRIPT_DIR)." >&2
    echo "   최신 클론에서 실행할 것. stale 트리로 서빙본을 덮으면 사고다." >&2
    exit 1
fi
SRC="$ROOT/apps/web/static/emoticons"
[ -d "$SRC" ] || { echo "⛔ 소스 없음: $SRC" >&2; exit 1; }
[ -d "$DEST" ] || { echo "⛔ 서빙 디렉토리 없음: $DEST" >&2; exit 1; }

# ⛔ stale checkout 방지 — 서빙본을 옛 트리로 되돌리는 사고가 제일 무섭다.
#
# 단 판정 대상은 **이모티콘 디렉토리뿐**이다. HEAD 가 뒤처졌다는 이유로 막으면
# 이모티콘과 무관한 커밋 하나에도 실행이 거부돼, 쓸 때마다 최신화를 강요받는다
# (2026-08-11 실측: 다른 세션 머지가 이어져 연속 3회 거부됨).
# 정작 위험한 건 "내 트리의 이모티콘이 origin/main 과 다른" 경우뿐이다.
git -C "$ROOT" fetch origin main --quiet 2>/dev/null || true
LOCAL=$(git -C "$ROOT" rev-parse --short HEAD)
REMOTE=$(git -C "$ROOT" rev-parse --short origin/main 2>/dev/null || echo "")
# `origin/main HEAD` 로 비교하면 커밋끼리만 봐서 **워킹트리 오염**(수동 삭제·수정)을
# 놓친다. HEAD 를 빼면 origin/main ↔ 워킹트리 비교라 둘 다 잡힌다.
if [ -n "$REMOTE" ] && ! git -C "$ROOT" diff --quiet origin/main -- "apps/web/static/emoticons" 2>/dev/null; then
    echo "⛔ 이 트리의 이모티콘이 origin/main 과 다르다 (HEAD=$LOCAL, origin/main=$REMOTE)."
    echo "   옛 파일로 서빙본을 덮을 수 있다. 먼저 최신화할 것:"
    echo "     git -C $ROOT fetch origin main && git -C $ROOT checkout -B main origin/main"
    echo "   차이 확인: git -C $ROOT diff --stat origin/main -- apps/web/static/emoticons"
    exit 1
fi

added=(); differs=()
shopt -s nullglob
for f in "$SRC"/*.{gif,webp,png,jpg,jpeg}; do
    n=$(basename "$f")
    if [ ! -e "$DEST/$n" ]; then
        added+=("$n")
    elif ! cmp -s "$f" "$DEST/$n"; then
        differs+=("$n")
    fi
done
shopt -u nullglob

echo "소스 : $SRC (HEAD ${LOCAL:0:7})"
echo "대상 : $DEST"
echo "신규 : ${#added[@]}개 / 내용 다름: ${#differs[@]}개"
[ ${#added[@]} -gt 0 ] && printf '  + %s\n' "${added[@]:0:20}"
[ ${#added[@]} -gt 20 ] && echo "  ... 외 $(( ${#added[@]} - 20 ))개"
if [ ${#differs[@]} -gt 0 ]; then
    echo "  ⚠️ 내용이 다른 파일(기본은 건드리지 않음, --overwrite 필요):"
    printf '     ~ %s\n' "${differs[@]:0:10}"
fi

if [ "$APPLY" != "1" ]; then
    echo ""
    echo "dry-run — 반영하려면: sudo bash scripts/sync-emoticons-to-host.sh --apply"
    exit 0
fi

TS=$(date +%Y%m%d-%H%M%S)
BACKUP="$DEST/_backup_$TS"
copied=0
if [ ${#added[@]} -gt 0 ]; then
    for n in "${added[@]}"; do
        cp -p "$SRC/$n" "$DEST/$n"
        copied=$((copied + 1))
    done
fi
if [ "$OVERWRITE" = "1" ] && [ ${#differs[@]} -gt 0 ]; then
    mkdir -p "$BACKUP"
    for n in "${differs[@]}"; do
        cp -p "$DEST/$n" "$BACKUP/$n"
        cp -p "$SRC/$n" "$DEST/$n"
        copied=$((copied + 1))
    done
    echo "덮어쓴 파일 백업: $BACKUP"
fi
echo "✅ 반영 $copied 개"
echo "검증: curl -sI https://damoang.net/emoticons/<파일명> | head -1   # 200 이어야 한다"
