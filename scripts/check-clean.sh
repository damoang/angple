#!/bin/bash
#
# Git 저장소 상태 검증 스크립트
# 배포/빌드 전에 실행하여 문제를 사전에 방지합니다
#
# 사용법:
#   ./scripts/check-clean.sh        # 상태 확인만
#   ./scripts/check-clean.sh --fix  # 자동 수정 시도
#

set -e

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FIX_MODE=false
if [ "$1" = "--fix" ]; then
    FIX_MODE=true
fi

ISSUES_FOUND=0

echo -e "${BLUE}=========================================="
echo -e "  Git 저장소 상태 검증"
echo -e "==========================================${NC}"
echo ""

# 1. 추적되지 않은 파일 확인
echo -e "${BLUE}[1/5] 추적되지 않은 파일 확인...${NC}"
UNTRACKED=$(git ls-files --others --exclude-standard)
if [ -n "$UNTRACKED" ]; then
    echo -e "${YELLOW}⚠️  추적되지 않은 파일이 있습니다:${NC}"
    echo "$UNTRACKED" | head -5
    if [ $(echo "$UNTRACKED" | wc -l) -gt 5 ]; then
        echo "   ... (총 $(echo "$UNTRACKED" | wc -l)개)"
    fi

    # 빌드 파일인지 확인
    if echo "$UNTRACKED" | grep -qE "build/|\.svelte-kit/|node_modules/"; then
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        echo -e "${RED}   ❌ 빌드 파일이 추적되고 있습니다!${NC}"
        if [ "$FIX_MODE" = true ]; then
            echo -e "${GREEN}   🔧 .gitignore 추가 권장${NC}"
        fi
    fi
    echo ""
else
    echo -e "${GREEN}✅ 문제 없음${NC}"
    echo ""
fi

# 2. 수정된 파일 확인
echo -e "${BLUE}[2/5] 수정된 파일 확인...${NC}"
MODIFIED=$(git diff --name-only)
if [ -n "$MODIFIED" ]; then
    echo -e "${YELLOW}⚠️  수정된 파일이 있습니다:${NC}"
    echo "$MODIFIED" | head -5
    if [ $(echo "$MODIFIED" | wc -l) -gt 5 ]; then
        echo "   ... (총 $(echo "$MODIFIED" | wc -l)개)"
    fi
    ISSUES_FOUND=$((ISSUES_FOUND + 1))

    if [ "$FIX_MODE" = true ]; then
        read -p "   커밋하시겠습니까? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git add -A
            git commit -m "chore: 배포 전 변경사항 커밋"
            echo -e "${GREEN}   ✅ 커밋 완료${NC}"
        fi
    fi
    echo ""
else
    echo -e "${GREEN}✅ 문제 없음${NC}"
    echo ""
fi

# 3. Staged 파일 확인
echo -e "${BLUE}[3/5] Staged 파일 확인...${NC}"
STAGED=$(git diff --cached --name-only)
if [ -n "$STAGED" ]; then
    echo -e "${YELLOW}⚠️  커밋 대기 중인 파일이 있습니다:${NC}"
    echo "$STAGED"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))

    if [ "$FIX_MODE" = true ]; then
        read -p "   커밋하시겠습니까? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git commit -m "chore: staged 파일 커밋"
            echo -e "${GREEN}   ✅ 커밋 완료${NC}"
        fi
    fi
    echo ""
else
    echo -e "${GREEN}✅ 문제 없음${NC}"
    echo ""
fi

# 4. 원격과 동기화 확인
echo -e "${BLUE}[4/5] 원격 저장소와 동기화 확인...${NC}"
git fetch origin
CURRENT_BRANCH=$(git branch --show-current)
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/$CURRENT_BRANCH 2>/dev/null || echo "")

if [ -z "$REMOTE_COMMIT" ]; then
    echo -e "${YELLOW}⚠️  원격 브랜치가 없습니다 (로컬 전용 브랜치)${NC}"
    echo ""
elif [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
    AHEAD=$(git rev-list --count origin/$CURRENT_BRANCH..HEAD)
    BEHIND=$(git rev-list --count HEAD..origin/$CURRENT_BRANCH)

    if [ "$AHEAD" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  로컬이 원격보다 $AHEAD 커밋 앞서 있습니다${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        if [ "$FIX_MODE" = true ]; then
            read -p "   푸시하시겠습니까? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                git push origin "$CURRENT_BRANCH"
                echo -e "${GREEN}   ✅ 푸시 완료${NC}"
            fi
        fi
    fi

    if [ "$BEHIND" -gt 0 ]; then
        echo -e "${RED}⚠️  로컬이 원격보다 $BEHIND 커밋 뒤처져 있습니다${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        if [ "$FIX_MODE" = true ]; then
            echo -e "${YELLOW}   ./scripts/sync.sh 실행을 권장합니다${NC}"
        fi
    fi
    echo ""
else
    echo -e "${GREEN}✅ 원격과 동기화됨${NC}"
    echo ""
fi

# 5. data/ 디렉토리 추적 여부 확인
echo -e "${BLUE}[5/5] data/ 디렉토리 추적 확인...${NC}"
if git ls-files | grep -q "^data/"; then
    echo -e "${RED}❌ data/ 디렉토리가 Git에 추적되고 있습니다!${NC}"
    echo -e "   이는 형상관리 충돌을 유발할 수 있습니다."
    ISSUES_FOUND=$((ISSUES_FOUND + 1))

    if [ "$FIX_MODE" = true ]; then
        echo -e "${YELLOW}   .gitignore에 추가 후 다음 명령 실행:${NC}"
        echo -e "   ${BLUE}git rm -r --cached data/${NC}"
    fi
    echo ""
else
    echo -e "${GREEN}✅ 문제 없음${NC}"
    echo ""
fi

# 최종 결과
echo -e "${BLUE}==========================================${NC}"
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ 모든 검사 통과! 안전하게 배포 가능합니다.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  $ISSUES_FOUND개 이슈 발견${NC}"
    if [ "$FIX_MODE" = false ]; then
        echo -e "자동 수정: ${BLUE}./scripts/check-clean.sh --fix${NC}"
    fi
    exit 1
fi
