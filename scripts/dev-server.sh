#!/bin/bash
#
# 스테이징(dev) 서버 관리 스크립트
# 사용법:
#   ./scripts/dev-server.sh start    # 빌드 후 dev 서버 시작
#   ./scripts/dev-server.sh stop     # dev 서버 중지
#   ./scripts/dev-server.sh restart  # 재빌드 + 재시작
#   ./scripts/dev-server.sh status   # 상태 확인
#

DEV_DIR="/home/damoang/angple"
PORT=3011
LOG_FILE="/tmp/angple-dev.log"

case "$1" in
    start|restart)
        echo "📦 빌드 중..."
        cd "$DEV_DIR/packages/types"
        pnpm build 2>&1
        cd "$DEV_DIR/apps/web"
        npm run build 2>&1 | tail -3

        # 기존 프로세스 종료
        OLD_PID=$(lsof -t -i:$PORT 2>/dev/null || true)
        if [ -n "$OLD_PID" ]; then
            kill $OLD_PID 2>/dev/null || true
            sleep 2
        fi

        echo "🚀 dev 서버 시작 (포트: $PORT)..."
        cd "$DEV_DIR"
        PORT=$PORT nohup node apps/web/build/index.js > "$LOG_FILE" 2>&1 &
        sleep 3

        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" = "200" ]; then
            echo "✅ dev 서버 시작 완료"
            echo "   URL: dev.damoang.net"
            echo "   포트: $PORT"
            echo "   로그: $LOG_FILE"
        else
            echo "❌ 시작 실패 (HTTP: $HTTP_CODE)"
            echo "   로그 확인: cat $LOG_FILE"
        fi
        ;;

    stop)
        OLD_PID=$(lsof -t -i:$PORT 2>/dev/null || true)
        if [ -n "$OLD_PID" ]; then
            kill $OLD_PID 2>/dev/null
            echo "✅ dev 서버 중지 (PID: $OLD_PID)"
        else
            echo "ℹ️  실행 중인 dev 서버 없음"
        fi
        ;;

    status)
        OLD_PID=$(lsof -t -i:$PORT 2>/dev/null || true)
        if [ -n "$OLD_PID" ]; then
            echo "✅ dev 서버 실행 중 (PID: $OLD_PID, PORT: $PORT)"
        else
            echo "⏹  dev 서버 중지됨"
        fi
        ;;

    *)
        echo "사용법: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
