#!/bin/bash
#
# Git hooks 설치 스크립트
# pre-commit hook을 설치하여 자동 포맷팅 및 main 브랜치 보호 활성화
#
# 사용법:
#   ./scripts/setup-hooks.sh
#

set -e

# 색상 코드
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo -e "  Git Hooks 설치"
echo -e "==========================================${NC}"
echo ""

# pre-commit hook 생성
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# main 브랜치에 직접 커밋 방지
branch="$(git rev-parse --abbrev-ref HEAD)"

if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
    echo ""
    echo "⛔ main 브랜치에 직접 커밋할 수 없습니다!"
    echo ""
    echo "  브랜치를 만들어서 작업하세요:"
    echo "    git checkout -b feature/작업명"
    echo "    git checkout -b fix/버그명"
    echo ""
    echo "  긴급하게 main에 커밋해야 한다면:"
    echo "    git commit --no-verify"
    echo ""
    exit 1
fi

# 자동 포맷팅 (staged 파일만)
echo "🔧 코드 포맷팅 중..."
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|svelte|json|md)$' || true)

if [ -n "$STAGED_FILES" ]; then
    # prettier로 포맷팅
    echo "$STAGED_FILES" | xargs pnpm prettier --write --list-different 2>/dev/null || true

    # 포맷팅된 파일 다시 stage
    echo "$STAGED_FILES" | xargs git add

    echo "✅ 포맷팅 완료"
else
    echo "ℹ️  포맷팅 대상 파일 없음"
fi

exit 0
EOF

# 실행 권한 부여
chmod +x .git/hooks/pre-commit

echo -e "${GREEN}✅ pre-commit hook 설치 완료${NC}"
echo ""
echo "기능:"
echo "  • main 브랜치 직접 커밋 방지"
echo "  • 커밋 전 자동 코드 포맷팅 (prettier)"
echo ""
echo "이제 커밋할 때 자동으로 포맷팅이 적용됩니다!"
