#!/bin/bash
#
# Angple 프로덕션 배포 스크립트
# 사용법: ./scripts/deploy.sh
#
# dev.damoang.net에서 확인한 코드를 web.damoang.net에 배포
# 1. 빌드  2. 복사  3. 서버 재시작
#

set -e

DEV_DIR="/home/damoang/angple"
PROD_DIR="/home/damoang/angple-prod"
PORT=3012
LOG_FILE="/tmp/angple-prod.log"
PREMIUM_DIR="/home/damoang/angple-premium"

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
        if [ -t 0 ]; then
            echo -e "${YELLOW}⚠️  검증 실패. 계속하시겠습니까? (y/n)${NC}"
            read -r -n 1 REPLY
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo -e "${RED}배포 취소${NC}"
                exit 1
            fi
        else
            echo -e "${YELLOW}⚠️  검증 실패 (비대화형 모드: 계속 진행)${NC}"
        fi
    fi
fi

# 1. 빌드
echo ""
echo -e "${BLUE}📦 [1/4] 빌드 중...${NC}"
cd "$DEV_DIR/packages/types"
pnpm build 2>&1
cd "$DEV_DIR/apps/web"
pnpm build 2>&1 | tail -3

# 2. 빌드 결과 복사
echo ""
echo -e "${BLUE}📋 [2/4] 프로덕션에 복사 중...${NC}"
rsync -a --delete "$DEV_DIR/apps/web/build/" "$PROD_DIR/build/"
rsync -a "$DEV_DIR/data/" "$PROD_DIR/data/"
echo -e "${GREEN}   복사 완료: $(du -sh "$PROD_DIR/build/" | cut -f1)${NC}"

# .env 환경변수 동기화 (BACKEND_URL 등 포트 불일치 방지)
if [ -f "$DEV_DIR/apps/web/.env" ] && [ -f "$PROD_DIR/.env" ]; then
    for KEY in BACKEND_URL INTERNAL_API_URL; do
        SRC_VAL=$(grep "^${KEY}=" "$DEV_DIR/apps/web/.env" 2>/dev/null | head -1)
        if [ -n "$SRC_VAL" ]; then
            if grep -q "^${KEY}=" "$PROD_DIR/.env"; then
                sed -i "s|^${KEY}=.*|${SRC_VAL}|" "$PROD_DIR/.env"
            else
                echo "$SRC_VAL" >> "$PROD_DIR/.env"
            fi
        fi
    done
    echo -e "${GREEN}   .env 동기화 완료${NC}"
fi

# Premium 테마 심볼릭 링크
if [ -d "$PREMIUM_DIR/themes/damoang-default" ]; then
    ln -sfn "$PREMIUM_DIR/themes/damoang-default" "$PROD_DIR/themes/damoang-default"
    echo -e "${GREEN}   Premium 테마 링크 완료${NC}"
fi

# Premium 후처리 (API 프록시 등)
if [ -f "$PREMIUM_DIR/deploy/scripts/add-api-plugins-proxy.sh" ]; then
    bash "$PREMIUM_DIR/deploy/scripts/add-api-plugins-proxy.sh" "$PROD_DIR" "$PREMIUM_DIR" 2>/dev/null || true
fi

# 3. 서버 재시작
echo ""
echo -e "${BLUE}🔄 [3/4] 서버 재시작 중...${NC}"
OLD_PID=$(lsof -t -i:$PORT 2>/dev/null || true)
if [ -n "$OLD_PID" ]; then
    kill $OLD_PID 2>/dev/null || true
    sleep 2
fi

# .env 로드 후 서버 시작
cd "$PROD_DIR"
if [ -f "$PROD_DIR/.env" ]; then
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        eval "export $line"
    done < "$PROD_DIR/.env"
    set +a
fi
PORT=$PORT nohup node build/index.js > "$LOG_FILE" 2>&1 &
NEW_PID=$!
sleep 3

# 4. 검증
echo ""
echo -e "${BLUE}🔍 [4/4] 검증 중...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    POSTS=$(curl -s http://localhost:$PORT/ 2>/dev/null | grep -oP 'title:"[^"]*"' | wc -l)
    echo -e "${GREEN}   ✅ 서버 정상 (PID: $NEW_PID, PORT: $PORT, 게시글: ${POSTS}건)${NC}"
    echo ""
    echo -e "${GREEN}=========================================="
    echo -e "  배포 완료! web.damoang.net 확인하세요"
    echo -e "==========================================${NC}"
else
    echo -e "${RED}   ❌ 서버 시작 실패 (HTTP: $HTTP_CODE)${NC}"
    echo -e "${YELLOW}   로그 확인: tail -50 $LOG_FILE${NC}"
    exit 1
fi
