#!/bin/bash
#
# Angple 배포 스크립트
# 사용법: ./scripts/deploy.sh
#
# 1. angple/ 에서 빌드
# 2. angple-prod/ 에 빌드 결과 복사
# 3. 서버 재시작
#

set -e

DEV_DIR="/home/damoang/angple"
PROD_DIR="/home/damoang/angple-prod"
PORT=3010
LOG_FILE="/tmp/angple-prod.log"

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo -e "  Angple 배포 시작"
echo -e "==========================================${NC}"

# 0. 배포 전 검증
echo ""
echo -e "${BLUE}[0/4] 배포 전 검증...${NC}"
if [ -f "$DEV_DIR/scripts/check-clean.sh" ]; then
    if ! "$DEV_DIR/scripts/check-clean.sh"; then
        echo -e "${YELLOW}⚠️  검증 실패. 계속하시겠습니까? (y/n)${NC}"
        read -r -n 1 REPLY
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}배포 취소${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠️  check-clean.sh를 찾을 수 없습니다. 계속 진행...${NC}"
fi

# 1. 빌드
echo ""
echo -e "${BLUE}📦 [1/4] 빌드 중...${NC}"
cd "$DEV_DIR/apps/web"
pnpm build 2>&1 | tail -3

# 2. 빌드 결과 복사
echo ""
echo -e "${BLUE}📋 [2/4] 프로덕션에 복사 중...${NC}"
rsync -a --delete "$DEV_DIR/apps/web/build/" "$PROD_DIR/build/"
# data 디렉토리는 삭제하지 않고 동기화
rsync -a "$DEV_DIR/data/" "$PROD_DIR/data/"
echo -e "${GREEN}   복사 완료: $(du -sh "$PROD_DIR/build/" | cut -f1)${NC}"

# 3. 기존 서버 종료
echo ""
echo -e "${BLUE}🔄 [3/4] 서버 재시작 중...${NC}"
OLD_PID=$(lsof -t -i:$PORT 2>/dev/null || true)
if [ -n "$OLD_PID" ]; then
    kill $OLD_PID 2>/dev/null || true
    sleep 2
fi

# 4. 새 서버 시작
cd "$PROD_DIR"
PORT=$PORT nohup node build/index.js > "$LOG_FILE" 2>&1 &
NEW_PID=$!
sleep 3

# 확인
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}   ✅ 서버 시작 완료 (PID: $NEW_PID, PORT: $PORT)${NC}"
    echo ""
    echo -e "${GREEN}=========================================="
    echo -e "  배포 완료! web.damoang.net 확인하세요"
    echo -e "==========================================${NC}"
else
    echo -e "${RED}   ❌ 서버 시작 실패 (HTTP: $HTTP_CODE)${NC}"
    echo -e "${YELLOW}   로그 확인: tail -50 $LOG_FILE${NC}"
    exit 1
fi
