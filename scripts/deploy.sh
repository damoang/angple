#!/bin/bash
#
# Angple 무중단 배포 (Blue-Green)
#
# 사용법:
#   ./scripts/deploy.sh           # 무중단 배포
#   ./scripts/deploy.sh rollback  # 이전 버전으로 롤백
#
# Blue(3012) ↔ Green(3013) 포트 전환으로 다운타임 0
#

set -e

DEV_DIR="/home/damoang/angple"
PROD_DIR="/home/damoang/angple-prod"
PREMIUM_DIR="/home/damoang/angple-premium"
UPSTREAM_CONF="/etc/nginx/conf.d/angple-upstream.conf"
LOG_FILE="/tmp/angple-prod.log"

BLUE_PORT=3012
GREEN_PORT=3013

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 현재 활성 포트 확인
get_active_port() {
    grep -oP 'server 127\.0\.0\.1:\K[0-9]+' "$UPSTREAM_CONF" 2>/dev/null || echo "$BLUE_PORT"
}

# 비활성 포트 계산
get_inactive_port() {
    local active=$(get_active_port)
    if [ "$active" = "$BLUE_PORT" ]; then
        echo "$GREEN_PORT"
    else
        echo "$BLUE_PORT"
    fi
}

# .env 로드
load_env() {
    if [ -f "$PROD_DIR/.env" ]; then
        set -a
        while IFS= read -r line || [ -n "$line" ]; do
            [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
            eval "export $line"
        done < "$PROD_DIR/.env"
        set +a
    fi
}

# nginx upstream 전환
switch_upstream() {
    local new_port=$1
    echo "upstream angple_backend { server 127.0.0.1:${new_port}; }" | sudo tee "$UPSTREAM_CONF" > /dev/null
    sudo nginx -t 2>/dev/null && sudo nginx -s reload 2>/dev/null
}

# ── 롤백 ──
if [ "$1" = "rollback" ]; then
    ACTIVE=$(get_active_port)
    INACTIVE=$(get_inactive_port)
    INACTIVE_PID=$(lsof -t -i:$INACTIVE 2>/dev/null || true)

    if [ -z "$INACTIVE_PID" ]; then
        echo -e "${RED}롤백 불가: 이전 서버(포트 $INACTIVE)가 실행 중이지 않음${NC}"
        exit 1
    fi

    echo -e "${BLUE}롤백: $ACTIVE → $INACTIVE${NC}"
    switch_upstream "$INACTIVE"
    echo -e "${GREEN}✅ 롤백 완료 (활성 포트: $INACTIVE)${NC}"
    exit 0
fi

# ── 배포 시작 ──
echo -e "${BLUE}==========================================
  Angple 무중단 배포
==========================================${NC}"

ACTIVE_PORT=$(get_active_port)
NEW_PORT=$(get_inactive_port)
echo -e "   활성: ${GREEN}$ACTIVE_PORT${NC}  →  새 배포: ${BLUE}$NEW_PORT${NC}"

# 0. 검증
echo ""
echo -e "${BLUE}[0/5] 사전 검증...${NC}"
if [ -f "$DEV_DIR/scripts/check-clean.sh" ]; then
    if ! "$DEV_DIR/scripts/check-clean.sh"; then
        if [ -t 0 ]; then
            echo -e "${YELLOW}⚠️  검증 실패. 계속? (y/n)${NC}"
            read -r -n 1 REPLY; echo
            [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
        else
            echo -e "${YELLOW}⚠️  비대화형: 계속 진행${NC}"
        fi
    fi
fi

# 1. 빌드
echo ""
echo -e "${BLUE}[1/5] 빌드...${NC}"
cd "$DEV_DIR/packages/types" && pnpm build 2>&1 | tail -1
cd "$DEV_DIR/apps/web" && pnpm build 2>&1 | tail -3

# 2. 복사
echo ""
echo -e "${BLUE}[2/5] 복사...${NC}"
rsync -a --delete "$DEV_DIR/apps/web/build/" "$PROD_DIR/build/"
rsync -a "$DEV_DIR/data/" "$PROD_DIR/data/"

# .env 동기화
if [ -f "$DEV_DIR/apps/web/.env" ] && [ -f "$PROD_DIR/.env" ]; then
    for KEY in BACKEND_URL INTERNAL_API_URL; do
        SRC_VAL=$(grep "^${KEY}=" "$DEV_DIR/apps/web/.env" 2>/dev/null | head -1)
        if [ -n "$SRC_VAL" ]; then
            if grep -q "^${KEY}=" "$PROD_DIR/.env"; then
                sed -i "s|^${KEY}=.*|${SRC_VAL}|" "$PROD_DIR/.env"
            fi
        fi
    done
fi

# Premium 테마
[ -d "$PREMIUM_DIR/themes/damoang-default" ] && \
    ln -sfn "$PREMIUM_DIR/themes/damoang-default" "$PROD_DIR/themes/damoang-default"
[ -f "$PREMIUM_DIR/deploy/scripts/add-api-plugins-proxy.sh" ] && \
    bash "$PREMIUM_DIR/deploy/scripts/add-api-plugins-proxy.sh" "$PROD_DIR" "$PREMIUM_DIR" 2>/dev/null || true

echo -e "${GREEN}   복사 완료 ($(du -sh "$PROD_DIR/build/" | cut -f1))${NC}"

# 3. 새 서버 시작 (비활성 포트)
echo ""
echo -e "${BLUE}[3/5] 새 서버 시작 (포트 $NEW_PORT)...${NC}"

# 비활성 포트에 이전 프로세스 있으면 정리
OLD_INACTIVE=$(lsof -t -i:$NEW_PORT 2>/dev/null || true)
[ -n "$OLD_INACTIVE" ] && kill $OLD_INACTIVE 2>/dev/null && sleep 1

cd "$PROD_DIR"
load_env
PORT=$NEW_PORT nohup node build/index.js > "${LOG_FILE}.${NEW_PORT}" 2>&1 &
NEW_PID=$!

# 헬스체크 (최대 10초)
echo -n "   헬스체크"
for i in $(seq 1 10); do
    sleep 1
    echo -n "."
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$NEW_PORT/ 2>/dev/null || echo "000")
    [ "$HTTP" = "200" ] && break
done
echo ""

if [ "$HTTP" != "200" ]; then
    echo -e "${RED}   ❌ 새 서버 실패 (HTTP: $HTTP). 기존 서버 유지.${NC}"
    kill $NEW_PID 2>/dev/null || true
    echo -e "${YELLOW}   로그: tail -20 ${LOG_FILE}.${NEW_PORT}${NC}"
    exit 1
fi

POSTS=$(curl -s http://localhost:$NEW_PORT/ 2>/dev/null | grep -oP 'title:"[^"]*"' | wc -l)
echo -e "${GREEN}   ✅ 새 서버 정상 (PID: $NEW_PID, 게시글: ${POSTS}건)${NC}"

# 4. nginx 전환 (무중단)
echo ""
echo -e "${BLUE}[4/5] nginx 전환 ($ACTIVE_PORT → $NEW_PORT)...${NC}"
switch_upstream "$NEW_PORT"
echo -e "${GREEN}   ✅ 트래픽 전환 완료${NC}"

# 5. 이전 서버 종료
echo ""
echo -e "${BLUE}[5/5] 이전 서버 종료 (포트 $ACTIVE_PORT)...${NC}"
sleep 2
OLD_PID=$(lsof -t -i:$ACTIVE_PORT 2>/dev/null || true)
[ -n "$OLD_PID" ] && kill $OLD_PID 2>/dev/null
echo -e "${GREEN}   ✅ 정리 완료${NC}"

echo ""
echo -e "${GREEN}==========================================
  무중단 배포 완료!
  활성 포트: $NEW_PORT (PID: $NEW_PID)
  롤백: ./scripts/deploy.sh rollback
==========================================${NC}"
