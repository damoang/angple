#!/bin/bash
# ============================================
# Angple 로컬 개발 환경 원커맨드 시작
# ============================================
#
# 사용법: ./scripts/local-up.sh
#
# 동작:
#   1. Docker로 인프라(MySQL, Redis) + 백엔드 API 시작
#   2. angple-premium이 있으면 자동 install
#   3. pnpm install 실행
#   4. 접속 정보 출력
# ============================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 프로젝트 루트 디렉터리
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Angple 로컬 개발 환경 시작${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# ----------------------------------------
# 1. 필수 도구 확인
# ----------------------------------------
echo -e "${BLUE}[1/5]${NC} 필수 도구 확인..."

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}[ERROR]${NC} $1 이 설치되어 있지 않습니다."
        echo "  설치 방법: $2"
        exit 1
    fi
    echo -e "${GREEN}  [OK]${NC} $1 $(command -v "$1")"
}

check_command "docker" "https://docs.docker.com/get-docker/"
check_command "node" "https://nodejs.org/"
check_command "pnpm" "npm install -g pnpm"

# Docker 데몬 실행 확인
if ! docker info &> /dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} Docker 데몬이 실행되지 않고 있습니다."
    echo "  Docker Desktop을 시작하거나 'sudo systemctl start docker'를 실행하세요."
    exit 1
fi
echo -e "${GREEN}  [OK]${NC} Docker 데몬 실행 중"

# ----------------------------------------
# 2. 환경 변수 설정
# ----------------------------------------
echo ""
echo -e "${BLUE}[2/5]${NC} 환경 변수 확인..."

if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}  [INFO]${NC} .env.local이 없습니다. .env.example에서 복사합니다."
    cp .env.example .env.local
    echo -e "${GREEN}  [OK]${NC} .env.local 생성됨"
fi

if [ ! -f "apps/web/.env.local" ]; then
    echo -e "${YELLOW}  [INFO]${NC} apps/web/.env.local이 없습니다. .env.example에서 복사합니다."
    cp apps/web/.env.example apps/web/.env.local
    echo -e "${GREEN}  [OK]${NC} apps/web/.env.local 생성됨"
fi

echo -e "${GREEN}  [OK]${NC} 환경 변수 준비됨"

# ----------------------------------------
# 3. Docker 인프라 + 백엔드 시작
# ----------------------------------------
echo ""
echo -e "${BLUE}[3/5]${NC} Docker 인프라 시작 (MySQL, Redis, API)..."

# angple-backend 경로 확인
BACKEND_PATH="../angple-backend"
if [ -d "$BACKEND_PATH" ]; then
    echo -e "${GREEN}  [OK]${NC} angple-backend 발견: $BACKEND_PATH"
    ANGPLE_BACKEND_PATH="$BACKEND_PATH" docker compose -f compose.local.yml up -d
else
    echo -e "${YELLOW}  [WARN]${NC} angple-backend가 없습니다. MySQL + Redis만 시작합니다."
    docker compose -f compose.local.yml up -d mysql redis
fi

echo -e "${GREEN}  [OK]${NC} Docker 서비스 시작됨"

# ----------------------------------------
# 4. Premium 에셋 설치 (있는 경우)
# ----------------------------------------
echo ""
echo -e "${BLUE}[4/5]${NC} Premium 에셋 확인..."

PREMIUM_PATH="../angple-premium"
if [ -d "$PREMIUM_PATH" ] && [ -f "$PREMIUM_PATH/deploy/install.sh" ]; then
    echo -e "${GREEN}  [OK]${NC} angple-premium 발견. 에셋 설치 중..."
    bash "$PREMIUM_PATH/deploy/install.sh" "$PROJECT_ROOT"
else
    echo -e "${YELLOW}  [SKIP]${NC} angple-premium 없음 (오픈소스 모드로 실행)"
fi

# ----------------------------------------
# 5. Node.js 의존성 설치
# ----------------------------------------
echo ""
echo -e "${BLUE}[5/5]${NC} Node.js 의존성 설치..."

pnpm install
echo -e "${GREEN}  [OK]${NC} 의존성 설치 완료"

# ----------------------------------------
# 완료 메시지
# ----------------------------------------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  로컬 개발 환경 준비 완료!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  프론트엔드 시작:"
echo -e "    ${BLUE}pnpm dev${NC}              # http://localhost:3010"
echo ""
echo "  인프라 서비스:"
echo -e "    MySQL:  ${BLUE}localhost:3306${NC}  (user: angple_user / pass: angple_pass)"
echo -e "    Redis:  ${BLUE}localhost:6379${NC}"
if [ -d "$BACKEND_PATH" ]; then
echo -e "    API:    ${BLUE}localhost:8081${NC}  (http://localhost:8081/api/v2)"
fi
echo ""
echo "  유용한 명령어:"
echo "    docker compose -f compose.local.yml logs -f    # 로그 확인"
echo "    docker compose -f compose.local.yml down        # 인프라 종료"
echo "    docker compose -f compose.local.yml down -v     # 데이터 초기화"
echo ""
