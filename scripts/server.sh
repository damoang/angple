#!/bin/bash
#
# Angple 서버 통합 관리 스크립트
# 사용법:
#   ./scripts/server.sh dev start     # dev 서버 시작
#   ./scripts/server.sh web start     # web 서버 시작
#   ./scripts/server.sh all start     # 모든 서버 시작
#   ./scripts/server.sh dev stop      # dev 서버 중지
#   ./scripts/server.sh all status    # 모든 서버 상태 확인
#

set -e

DEV_DIR="/home/damoang/angple"
PROD_DIR="/home/damoang/angple-prod"
DEV_PORT=3011
WEB_PORT=3010
DEV_LOG="/tmp/angple-dev.log"
WEB_LOG="/tmp/angple-prod.log"

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 서버 시작 함수
start_server() {
    local SERVER=$1
    local DIR=""
    local PORT=""
    local LOG=""
    local NAME=""

    if [ "$SERVER" = "dev" ]; then
        DIR="$DEV_DIR"
        PORT=$DEV_PORT
        LOG=$DEV_LOG
        NAME="dev.damoang.net"
    elif [ "$SERVER" = "web" ]; then
        DIR="$PROD_DIR"
        PORT=$WEB_PORT
        LOG=$WEB_LOG
        NAME="web.damoang.net"
    else
        echo -e "${RED}❌ 알 수 없는 서버: $SERVER${NC}"
        return 1
    fi

    echo -e "${BLUE}📦 $NAME 빌드 중...${NC}"

    # dev 서버는 angple/에서 빌드
    if [ "$SERVER" = "dev" ]; then
        cd "$DEV_DIR/apps/web"
        pnpm build 2>&1 | tail -5
    else
        # web 서버는 이미 배포된 빌드 사용
        if [ ! -d "$PROD_DIR/build" ]; then
            echo -e "${RED}❌ 프로덕션 빌드가 없습니다. ./scripts/deploy.sh 실행 필요${NC}"
            return 1
        fi
    fi

    # 기존 프로세스 종료
    OLD_PID=$(lsof -t -i:$PORT 2>/dev/null || true)
    if [ -n "$OLD_PID" ]; then
        echo -e "${YELLOW}⏹  기존 프로세스 종료 (PID: $OLD_PID)${NC}"
        kill $OLD_PID 2>/dev/null || true
        sleep 2
    fi

    # 서버 시작
    echo -e "${BLUE}🚀 $NAME 시작 중 (포트: $PORT)...${NC}"
    cd "$DIR"

    if [ "$SERVER" = "dev" ]; then
        PORT=$PORT nohup node apps/web/build/index.js > "$LOG" 2>&1 &
    else
        PORT=$PORT nohup node build/index.js > "$LOG" 2>&1 &
    fi

    sleep 3

    # 상태 확인
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ $NAME 시작 완료${NC}"
        echo -e "   URL: ${GREEN}https://$NAME${NC}"
        echo -e "   포트: $PORT"
        echo -e "   로그: $LOG"
    else
        echo -e "${RED}❌ 시작 실패 (HTTP: $HTTP_CODE)${NC}"
        echo -e "   로그 확인: ${YELLOW}tail -50 $LOG${NC}"
        return 1
    fi
}

# 서버 중지 함수
stop_server() {
    local SERVER=$1
    local PORT=""
    local NAME=""

    if [ "$SERVER" = "dev" ]; then
        PORT=$DEV_PORT
        NAME="dev.damoang.net"
    elif [ "$SERVER" = "web" ]; then
        PORT=$WEB_PORT
        NAME="web.damoang.net"
    else
        echo -e "${RED}❌ 알 수 없는 서버: $SERVER${NC}"
        return 1
    fi

    OLD_PID=$(lsof -t -i:$PORT 2>/dev/null || true)
    if [ -n "$OLD_PID" ]; then
        kill $OLD_PID 2>/dev/null || true
        echo -e "${GREEN}✅ $NAME 중지 (PID: $OLD_PID)${NC}"
    else
        echo -e "${YELLOW}ℹ️  $NAME 실행 중이 아님${NC}"
    fi
}

# 서버 상태 확인 함수
status_server() {
    local SERVER=$1
    local PORT=""
    local NAME=""
    local LOG=""

    if [ "$SERVER" = "dev" ]; then
        PORT=$DEV_PORT
        NAME="dev.damoang.net"
        LOG=$DEV_LOG
    elif [ "$SERVER" = "web" ]; then
        PORT=$WEB_PORT
        NAME="web.damoang.net"
        LOG=$WEB_LOG
    else
        echo -e "${RED}❌ 알 수 없는 서버: $SERVER${NC}"
        return 1
    fi

    OLD_PID=$(lsof -t -i:$PORT 2>/dev/null || true)
    if [ -n "$OLD_PID" ]; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}✅ $NAME 실행 중 (PID: $OLD_PID, PORT: $PORT)${NC}"
            echo -e "   URL: https://$NAME"
            echo -e "   로그: tail -50 $LOG"
        else
            echo -e "${YELLOW}⚠️  $NAME 프로세스는 있으나 응답 없음 (HTTP: $HTTP_CODE)${NC}"
            echo -e "   로그 확인: tail -50 $LOG"
        fi
    else
        echo -e "${RED}⏹  $NAME 중지됨${NC}"
    fi
}

# 재시작 함수
restart_server() {
    local SERVER=$1
    stop_server "$SERVER"
    sleep 1
    start_server "$SERVER"
}

# 메인 로직
SERVER_TARGET=$1
ACTION=$2

if [ -z "$SERVER_TARGET" ] || [ -z "$ACTION" ]; then
    echo "사용법: $0 {dev|web|all} {start|stop|restart|status}"
    echo ""
    echo "예시:"
    echo "  $0 dev start     # dev 서버 시작"
    echo "  $0 web start     # web 서버 시작"
    echo "  $0 all start     # 모든 서버 시작"
    echo "  $0 dev stop      # dev 서버 중지"
    echo "  $0 all status    # 모든 서버 상태 확인"
    echo "  $0 web restart   # web 서버 재시작"
    exit 1
fi

case "$ACTION" in
    start)
        if [ "$SERVER_TARGET" = "all" ]; then
            start_server "dev"
            echo ""
            start_server "web"
        else
            start_server "$SERVER_TARGET"
        fi
        ;;
    stop)
        if [ "$SERVER_TARGET" = "all" ]; then
            stop_server "dev"
            stop_server "web"
        else
            stop_server "$SERVER_TARGET"
        fi
        ;;
    restart)
        if [ "$SERVER_TARGET" = "all" ]; then
            restart_server "dev"
            echo ""
            restart_server "web"
        else
            restart_server "$SERVER_TARGET"
        fi
        ;;
    status)
        if [ "$SERVER_TARGET" = "all" ]; then
            status_server "dev"
            echo ""
            status_server "web"
        else
            status_server "$SERVER_TARGET"
        fi
        ;;
    *)
        echo -e "${RED}❌ 알 수 없는 액션: $ACTION${NC}"
        echo "사용 가능: start, stop, restart, status"
        exit 1
        ;;
esac
