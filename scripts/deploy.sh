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

echo "=========================================="
echo "  Angple 배포 시작"
echo "=========================================="

# 1. 빌드
echo ""
echo "📦 [1/4] 빌드 중..."
cd "$DEV_DIR/apps/web"
pnpm build 2>&1 | tail -3

# 2. 빌드 결과 복사
echo ""
echo "📋 [2/4] 프로덕션에 복사 중..."
rsync -a --delete "$DEV_DIR/apps/web/build/" "$PROD_DIR/build/"
# data 디렉토리는 삭제하지 않고 동기화
rsync -a "$DEV_DIR/data/" "$PROD_DIR/data/"
echo "   복사 완료: $(du -sh "$PROD_DIR/build/" | cut -f1)"

# 3. 기존 서버 종료
echo ""
echo "🔄 [3/4] 서버 재시작 중..."
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
    echo "   ✅ 서버 시작 완료 (PID: $NEW_PID, PORT: $PORT)"
    echo ""
    echo "=========================================="
    echo "  배포 완료! web.damoang.net 확인하세요"
    echo "=========================================="
else
    echo "   ❌ 서버 시작 실패 (HTTP: $HTTP_CODE)"
    echo "   로그 확인: cat $LOG_FILE"
    exit 1
fi
