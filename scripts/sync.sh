#!/bin/bash
#
# Angple 안전한 형상관리 동기화 스크립트
# 로컬 변경사항을 보존하면서 최신 코드를 가져옵니다
#
# 사용법:
#   ./scripts/sync.sh              # 현재 브랜치 업데이트
#   ./scripts/sync.sh main         # main 브랜치로 전환 후 업데이트
#   ./scripts/sync.sh --force      # 강제 업데이트 (로컬 변경 무시)
#

set -e

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TARGET_BRANCH=${1:-$(git branch --show-current)}
FORCE_MODE=false

if [ "$1" = "--force" ] || [ "$2" = "--force" ]; then
    FORCE_MODE=true
fi

echo -e "${BLUE}=========================================="
echo -e "  Angple 형상관리 동기화"
echo -e "==========================================${NC}"
echo ""

# 1. Git 상태 확인
echo -e "${BLUE}[1/6] Git 상태 확인 중...${NC}"
git fetch origin

# 변경된 파일 확인
CHANGED_FILES=$(git status --porcelain)
if [ -n "$CHANGED_FILES" ]; then
    echo -e "${YELLOW}⚠️  로컬에 변경된 파일이 있습니다:${NC}"
    echo "$CHANGED_FILES" | head -10
    if [ $(echo "$CHANGED_FILES" | wc -l) -gt 10 ]; then
        echo "   ... ($(echo "$CHANGED_FILES" | wc -l)개 파일)"
    fi
    echo ""

    if [ "$FORCE_MODE" = true ]; then
        echo -e "${RED}⚠️⚠️⚠️  위험: 로컬 변경사항이 영구적으로 삭제됩니다!${NC}"
        echo -e "${YELLOW}변경된 파일 수: $(echo "$CHANGED_FILES" | wc -l)개${NC}"
        echo ""
        echo -e "${YELLOW}정말로 모든 로컬 변경사항을 삭제하시겠습니까?${NC}"
        echo -e "삭제 전에 백업 브랜치를 생성하는 것을 권장합니다."
        echo ""
        read -p "계속하려면 'DELETE'를 입력하세요: " CONFIRM

        if [ "$CONFIRM" = "DELETE" ]; then
            echo -e "${RED}로컬 변경사항을 삭제합니다...${NC}"
            git reset --hard HEAD
            git clean -fd
            echo -e "${GREEN}삭제 완료${NC}"
        else
            echo -e "${GREEN}취소되었습니다. 대신 stash를 사용합니다.${NC}"
            git stash push -m "sync.sh auto-stash $(date +%Y%m%d_%H%M%S)"
            STASHED=true
        fi
    else
        echo -e "${YELLOW}💾 로컬 변경사항을 임시 저장(stash)합니다...${NC}"
        git stash push -m "sync.sh auto-stash $(date +%Y%m%d_%H%M%S)"
        STASHED=true
    fi
fi

# 2. 브랜치 전환
echo -e "${BLUE}[2/6] 브랜치 확인 중...${NC}"
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ]; then
    echo -e "${YELLOW}   현재: $CURRENT_BRANCH → 전환: $TARGET_BRANCH${NC}"
    git checkout "$TARGET_BRANCH"
else
    echo -e "${GREEN}   ✅ $TARGET_BRANCH 브랜치${NC}"
fi

# 3. 최신 코드 가져오기
echo -e "${BLUE}[3/6] 최신 코드 가져오기 (pull)...${NC}"
git pull origin "$TARGET_BRANCH" --rebase

# 4. Stash 복원
if [ "${STASHED:-false}" = true ]; then
    echo -e "${BLUE}[4/6] 임시 저장한 변경사항 복원 중...${NC}"
    if git stash pop; then
        echo -e "${GREEN}   ✅ 변경사항 복원 완료${NC}"
    else
        echo -e "${RED}   ⚠️  충돌 발생! 수동으로 해결해야 합니다${NC}"
        echo -e "   ${YELLOW}충돌 해결 후: git add . && git stash drop${NC}"
    fi
else
    echo -e "${BLUE}[4/6] (stash 없음, 생략)${NC}"
fi

# 5. 의존성 업데이트 확인
echo -e "${BLUE}[5/6] 의존성 변경사항 확인 중...${NC}"
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json\|pnpm-lock.yaml"; then
    echo -e "${YELLOW}   ⚠️  package.json 변경 감지 → pnpm install 실행${NC}"
    pnpm install
else
    echo -e "${GREEN}   ✅ 의존성 변경 없음${NC}"
fi

# 6. 빌드 파일 정리
echo -e "${BLUE}[6/6] 빌드 캐시 정리 중...${NC}"
rm -rf apps/web/.svelte-kit apps/web/build apps/admin/.svelte-kit apps/admin/build 2>/dev/null || true
echo -e "${GREEN}   ✅ 빌드 캐시 삭제 완료${NC}"

# 최종 상태
echo ""
echo -e "${GREEN}=========================================="
echo -e "  동기화 완료!"
echo -e "==========================================${NC}"
echo -e "현재 브랜치: ${GREEN}$(git branch --show-current)${NC}"
echo -e "최신 커밋: ${YELLOW}$(git log -1 --oneline)${NC}"
echo ""
echo -e "다음 단계:"
echo -e "  ${BLUE}1. 개발:${NC} ./scripts/server.sh dev restart"
echo -e "  ${BLUE}2. 배포:${NC} ./scripts/deploy.sh"
echo -e "  ${BLUE}3. 상태:${NC} ./scripts/server.sh all status"
