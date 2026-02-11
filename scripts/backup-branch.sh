#!/bin/bash
#
# 현재 작업 내용을 백업 브랜치로 저장
# git reset --hard 같은 위험한 명령어를 사용하기 전에 실행하세요
#
# 사용법:
#   ./scripts/backup-branch.sh                    # 자동 이름으로 백업
#   ./scripts/backup-branch.sh "내 백업"          # 커스텀 이름으로 백업
#

set -e

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME=${1:-"backup-$TIMESTAMP"}

echo -e "${BLUE}=========================================="
echo -e "  작업 내용 백업"
echo -e "==========================================${NC}"
echo ""

# 현재 브랜치 확인
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}현재 브랜치: ${GREEN}$CURRENT_BRANCH${NC}"

# 변경사항 확인
CHANGED_FILES=$(git status --porcelain)
if [ -z "$CHANGED_FILES" ]; then
    echo -e "${GREEN}✅ 변경사항이 없습니다. 백업 불필요${NC}"
    exit 0
fi

echo -e "${YELLOW}변경된 파일 수: $(echo "$CHANGED_FILES" | wc -l)개${NC}"
echo "$CHANGED_FILES" | head -5
if [ $(echo "$CHANGED_FILES" | wc -l) -gt 5 ]; then
    echo "   ... 외 $(($(echo "$CHANGED_FILES" | wc -l) - 5))개"
fi
echo ""

# 백업 브랜치 생성
echo -e "${BLUE}백업 브랜치 생성: ${GREEN}$BACKUP_NAME${NC}"
git checkout -b "$BACKUP_NAME"

# 모든 변경사항 커밋
echo -e "${BLUE}변경사항 커밋 중...${NC}"
git add -A
git commit -m "Backup: $(date '+%Y-%m-%d %H:%M:%S') from $CURRENT_BRANCH"

echo ""
echo -e "${GREEN}=========================================="
echo -e "  백업 완료!"
echo -e "==========================================${NC}"
echo -e "백업 브랜치: ${GREEN}$BACKUP_NAME${NC}"
echo ""
echo -e "이제 안전하게 원래 브랜치로 돌아가세요:"
echo -e "  ${BLUE}git checkout $CURRENT_BRANCH${NC}"
echo ""
echo -e "백업을 복원하려면:"
echo -e "  ${BLUE}git checkout $BACKUP_NAME${NC}"
echo ""
echo -e "백업이 필요 없어졌을 때 삭제:"
echo -e "  ${BLUE}git branch -D $BACKUP_NAME${NC}"
