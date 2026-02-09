#!/bin/bash
#
# PR 올린 후 브랜치 정리 스크립트
# 사용법: ./scripts/finish-branch.sh
#
# 현재 브랜치를 삭제하고 main으로 돌아옴
#

set -e

CURRENT=$(git branch --show-current)

if [ "$CURRENT" = "main" ]; then
    echo "❌ 이미 main 브랜치입니다"
    exit 1
fi

echo ""
echo "🔄 main으로 이동 + 최신화..."
git checkout main
git pull origin main

echo ""
echo "🗑️  로컬 브랜치 삭제: $CURRENT"
git branch -D "$CURRENT"

echo ""
echo "✅ 완료!"
echo "   현재: main ($(git log --oneline -1))"
echo ""
echo "다음 작업:"
echo "   ./scripts/new-branch.sh fix/다음작업명"
echo ""
