#!/bin/bash
#
# 새 작업 브랜치 시작 스크립트
# 사용법: ./scripts/new-branch.sh fix/버그명
#         ./scripts/new-branch.sh feat/기능명
#

set -e

if [ -z "$1" ]; then
    echo ""
    echo "사용법: $0 <브랜치명>"
    echo ""
    echo "예시:"
    echo "  $0 fix/sidebar-bug"
    echo "  $0 feat/dark-mode"
    echo "  $0 fix/login-error"
    echo ""
    exit 1
fi

BRANCH_NAME="$1"

echo ""
echo "🔄 main 브랜치로 이동 및 최신화..."
git checkout main
git pull origin main

echo ""
echo "🌿 새 브랜치 생성: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"

echo ""
echo "✅ 준비 완료!"
echo "   브랜치: $BRANCH_NAME"
echo "   base: $(git log --oneline -1 main)"
echo ""
echo "작업 완료 후:"
echo "   git add <파일들>"
echo "   git commit -m \"커밋 메시지\""
echo "   git push origin $BRANCH_NAME"
echo ""
