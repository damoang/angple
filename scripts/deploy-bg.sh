#!/bin/bash
#
# Angple 블루-그린 배포 스크립트
# 사용법: ./scripts/deploy-bg.sh
#
# 다운타임 0초 배포:
#   1. 빌드
#   2. 비활성 슬롯에 복사
#   3. 비활성 슬롯 서버 시작 + 헬스체크
#   4. nginx upstream 전환 + reload
#   5. 이전 슬롯 서버 종료
#
# 롤백: ./scripts/deploy-bg.sh rollback
#

set -e

DEV_DIR="/home/damoang/angple"
BLUE_DIR="/home/damoang/angple-prod-blue"
GREEN_DIR="/home/damoang/angple-prod-green"
BLUE_PORT=3010
GREEN_PORT=3012
STATE_FILE="/home/damoang/.angple-active"
NGINX_UPSTREAM="/etc/nginx/conf.d/angple-upstream.conf"
LOG_DIR="/tmp"
HEALTH_TIMEOUT=10
HEALTH_RETRIES=5

# 색상 코드
RED='\033[0;31m'
GREEN_C='\033[0;32m'
YELLOW='\033[1;33m'
BLUE_C='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 현재 활성 슬롯 읽기 (기본: blue)
get_active() {
    if [ -f "$STATE_FILE" ]; then
        cat "$STATE_FILE"
    else
        echo "blue"
    fi
}

get_port() {
    if [ "$1" = "blue" ]; then echo $BLUE_PORT; else echo $GREEN_PORT; fi
}

get_dir() {
    if [ "$1" = "blue" ]; then echo "$BLUE_DIR"; else echo "$GREEN_DIR"; fi
}

get_log() {
    echo "$LOG_DIR/angple-$1.log"
}

# 헬스체크
health_check() {
    local port=$1
    local attempt=0
    while [ $attempt -lt $HEALTH_RETRIES ]; do
        local code
        code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/" 2>/dev/null || echo "000")
        if [ "$code" = "200" ]; then
            return 0
        fi
        attempt=$((attempt + 1))
        echo -e "   ${YELLOW}헬스체크 재시도 ($attempt/$HEALTH_RETRIES)... HTTP $code${NC}"
        sleep 2
    done
    return 1
}

# nginx upstream 전환
switch_nginx() {
    local port=$1
    echo "upstream angple_backend { server 127.0.0.1:$port; }" | sudo tee "$NGINX_UPSTREAM" > /dev/null
    sudo nginx -t 2>&1 && sudo nginx -s reload
}

# .env 복사 + 동기화
sync_env() {
    local target_dir=$1
    local target_port=$2

    # 기본 .env가 없으면 생성
    if [ ! -f "$target_dir/.env" ]; then
        cp "$DEV_DIR/apps/web/.env" "$target_dir/.env" 2>/dev/null || true
    fi

    # BACKEND_URL, INTERNAL_API_URL 동기화
    if [ -f "$DEV_DIR/apps/web/.env" ]; then
        for KEY in BACKEND_URL INTERNAL_API_URL; do
            SRC_VAL=$(grep "^${KEY}=" "$DEV_DIR/apps/web/.env" 2>/dev/null | head -1)
            if [ -n "$SRC_VAL" ]; then
                if grep -q "^${KEY}=" "$target_dir/.env"; then
                    sed -i "s|^${KEY}=.*|${SRC_VAL}|" "$target_dir/.env"
                else
                    echo "$SRC_VAL" >> "$target_dir/.env"
                fi
            fi
        done
    fi

    # PORT 설정
    if grep -q "^PORT=" "$target_dir/.env"; then
        sed -i "s|^PORT=.*|PORT=$target_port|" "$target_dir/.env"
    else
        echo "PORT=$target_port" >> "$target_dir/.env"
    fi
}

# 슬롯 디렉토리 초기화
init_slot() {
    local dir=$1
    if [ ! -d "$dir" ]; then
        echo -e "   ${CYAN}슬롯 디렉토리 생성: $dir${NC}"
        mkdir -p "$dir"
    fi

    # 심볼릭 링크 설정 (공유 자원)
    for link in themes custom-themes plugins widgets; do
        if [ ! -L "$dir/$link" ] && [ -d "$DEV_DIR/$link" ]; then
            ln -sfn "$DEV_DIR/$link" "$dir/$link"
        fi
    done

    # data 디렉토리 (공유)
    if [ ! -d "$dir/data" ]; then
        mkdir -p "$dir/data"
    fi

    # node_modules (첫 실행 시만)
    if [ ! -d "$dir/node_modules" ]; then
        echo -e "   ${CYAN}node_modules 복사 중...${NC}"
        if [ -d "/home/damoang/angple-prod/node_modules" ]; then
            cp -r "/home/damoang/angple-prod/node_modules" "$dir/node_modules"
        fi
        if [ -f "/home/damoang/angple-prod/package.json" ]; then
            cp "/home/damoang/angple-prod/package.json" "$dir/package.json"
        fi
    fi
}

# .env 로드
load_env() {
    local dir=$1
    if [ -f "$dir/.env" ]; then
        set -a
        while IFS= read -r line || [ -n "$line" ]; do
            [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
            eval "export $line"
        done < "$dir/.env"
        set +a
    fi
}

# 서버 시작
start_server() {
    local dir=$1
    local port=$2
    local log
    log=$(get_log "$3")

    cd "$dir"
    load_env "$dir"
    PORT=$port nohup node build/index.js > "$log" 2>&1 &
    echo $!
}

# 서버 종료
stop_server() {
    local port=$1
    local pid
    pid=$(lsof -t -i:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        kill $pid 2>/dev/null || true
        # 최대 5초 대기
        local wait=0
        while [ $wait -lt 5 ] && kill -0 $pid 2>/dev/null; do
            sleep 1
            wait=$((wait + 1))
        done
        # 여전히 살아있으면 강제 종료
        kill -0 $pid 2>/dev/null && kill -9 $pid 2>/dev/null || true
    fi
}

# Premium 테마 링크
setup_premium() {
    local dir=$1
    local premium_dir="/home/damoang/angple-premium"
    if [ -d "$premium_dir/themes/damoang-default" ]; then
        ln -sfn "$premium_dir/themes/damoang-default" "$dir/themes/damoang-default"
    fi
    if [ -d "$premium_dir/deploy/scripts" ]; then
        for script in "$premium_dir/deploy/scripts"/*.sh; do
            [ -f "$script" ] && bash "$script" "$dir" "$premium_dir"
        done
    fi
}

# ===========================
# 롤백 명령
# ===========================
if [ "${1:-}" = "rollback" ]; then
    ACTIVE=$(get_active)
    if [ "$ACTIVE" = "blue" ]; then TARGET="green"; else TARGET="blue"; fi
    TARGET_PORT=$(get_port "$TARGET")
    TARGET_DIR=$(get_dir "$TARGET")

    echo -e "${YELLOW}=========================================="
    echo -e "  롤백: $ACTIVE → $TARGET"
    echo -e "==========================================${NC}"

    # 이전 슬롯에 빌드가 있는지 확인
    if [ ! -f "$TARGET_DIR/build/index.js" ]; then
        echo -e "${RED}❌ 롤백 불가: $TARGET 슬롯에 빌드가 없습니다${NC}"
        exit 1
    fi

    # 이전 슬롯 서버 시작
    echo -e "${BLUE_C}[1/3] $TARGET 서버 시작 (포트 $TARGET_PORT)...${NC}"
    start_server "$TARGET_DIR" "$TARGET_PORT" "$TARGET"
    sleep 3

    if ! health_check "$TARGET_PORT"; then
        echo -e "${RED}❌ 롤백 실패: $TARGET 헬스체크 실패${NC}"
        stop_server "$TARGET_PORT"
        exit 1
    fi

    # nginx 전환
    echo -e "${BLUE_C}[2/3] nginx 전환...${NC}"
    switch_nginx "$TARGET_PORT"

    # 현재 서버 종료
    ACTIVE_PORT=$(get_port "$ACTIVE")
    echo -e "${BLUE_C}[3/3] $ACTIVE 서버 종료 (포트 $ACTIVE_PORT)...${NC}"
    stop_server "$ACTIVE_PORT"

    # 상태 저장
    echo "$TARGET" > "$STATE_FILE"

    echo -e "${GREEN_C}=========================================="
    echo -e "  롤백 완료! $TARGET (포트 $TARGET_PORT) 활성"
    echo -e "==========================================${NC}"
    exit 0
fi

# ===========================
# 메인 배포 프로세스
# ===========================
ACTIVE=$(get_active)
if [ "$ACTIVE" = "blue" ]; then TARGET="green"; else TARGET="blue"; fi
ACTIVE_PORT=$(get_port "$ACTIVE")
TARGET_PORT=$(get_port "$TARGET")
ACTIVE_DIR=$(get_dir "$ACTIVE")
TARGET_DIR=$(get_dir "$TARGET")

echo -e "${BLUE_C}=========================================="
echo -e "  Angple 블루-그린 배포"
echo -e "  활성: $ACTIVE (포트 $ACTIVE_PORT)"
echo -e "  배포 대상: $TARGET (포트 $TARGET_PORT)"
echo -e "==========================================${NC}"

# 0. 검증
echo ""
echo -e "${BLUE_C}[0/5] 배포 전 검증...${NC}"
if [ -f "$DEV_DIR/scripts/check-clean.sh" ]; then
    "$DEV_DIR/scripts/check-clean.sh" || true
fi

# 1. 빌드
echo ""
echo -e "${BLUE_C}[1/5] 빌드 중...${NC}"
cd "$DEV_DIR/packages/types"
pnpm build 2>&1
cd "$DEV_DIR/apps/web"
pnpm build 2>&1 | tail -3

# 2. 비활성 슬롯에 복사
echo ""
echo -e "${BLUE_C}[2/5] $TARGET 슬롯에 복사 중...${NC}"
init_slot "$TARGET_DIR"
rsync -a --delete "$DEV_DIR/apps/web/build/" "$TARGET_DIR/build/"
rsync -a "$DEV_DIR/data/" "$TARGET_DIR/data/"
sync_env "$TARGET_DIR" "$TARGET_PORT"
setup_premium "$TARGET_DIR"
echo -e "${GREEN_C}   복사 완료: $(du -sh "$TARGET_DIR/build/" | cut -f1)${NC}"

# 3. 비활성 슬롯 서버 시작 + 헬스체크
echo ""
echo -e "${BLUE_C}[3/5] $TARGET 서버 시작 (포트 $TARGET_PORT)...${NC}"

# 혹시 이전 프로세스가 남아있으면 정리
stop_server "$TARGET_PORT"

NEW_PID=$(start_server "$TARGET_DIR" "$TARGET_PORT" "$TARGET")
sleep 3

echo -e "   ${CYAN}헬스체크 중...${NC}"
if ! health_check "$TARGET_PORT"; then
    echo -e "${RED}❌ $TARGET 서버 시작 실패! 배포 중단${NC}"
    echo -e "${YELLOW}   로그: tail -50 $(get_log "$TARGET")${NC}"
    stop_server "$TARGET_PORT"
    echo -e "${GREEN_C}   기존 $ACTIVE 서버 유지 (포트 $ACTIVE_PORT)${NC}"
    exit 1
fi
echo -e "${GREEN_C}   ✅ $TARGET 서버 정상 (PID: $NEW_PID, 포트 $TARGET_PORT)${NC}"

# 4. nginx 전환
echo ""
echo -e "${BLUE_C}[4/5] nginx upstream 전환 → 포트 $TARGET_PORT...${NC}"
if switch_nginx "$TARGET_PORT"; then
    echo -e "${GREEN_C}   ✅ nginx 전환 완료${NC}"
else
    echo -e "${RED}❌ nginx 전환 실패! $TARGET 서버 종료, 기존 유지${NC}"
    stop_server "$TARGET_PORT"
    exit 1
fi

# 5. 이전 슬롯 서버 종료
echo ""
echo -e "${BLUE_C}[5/5] 이전 $ACTIVE 서버 종료 (포트 $ACTIVE_PORT)...${NC}"
stop_server "$ACTIVE_PORT"
echo -e "${GREEN_C}   ✅ $ACTIVE 서버 종료 완료${NC}"

# 상태 저장
echo "$TARGET" > "$STATE_FILE"

echo ""
echo -e "${GREEN_C}=========================================="
echo -e "  블루-그린 배포 완료!"
echo -e "  활성: $TARGET (포트 $TARGET_PORT)"
echo -e "  롤백: ./scripts/deploy-bg.sh rollback"
echo -e "==========================================${NC}"
