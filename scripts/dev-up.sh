#!/bin/bash
# ============================================
# Angple 개발용 Docker Compose 시작
# ============================================
#
# 사용법:
#   ./scripts/dev-up.sh
#   ./scripts/dev-up.sh --build
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} docker가 설치되어 있지 않습니다."
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} Docker 데몬이 실행 중이 아닙니다."
    exit 1
fi

export HOST_UID="${HOST_UID:-$(id -u)}"
export HOST_GID="${HOST_GID:-$(id -g)}"

echo -e "${BLUE}Starting dev compose...${NC}"
echo -e "${GREEN}[INFO]${NC} HOST_UID=${HOST_UID}, HOST_GID=${HOST_GID}"

# ----------------------------------------
# 환경 변수 설정
# ----------------------------------------
echo ""
echo -e "${BLUE}[2/3]${NC} 환경 변수 확인..."

if [ ! -f ".env.dev" ]; then
    echo -e "${YELLOW}  [INFO]${NC} .env.dev이 없습니다. .env.example에서 복사합니다."
    cp .env.example .env.dev
    echo -e "${GREEN}  [OK]${NC} .env.dev 생성됨"
fi

if [ ! -f "apps/web/.env.dev" ]; then
    echo -e "${YELLOW}  [INFO]${NC} apps/web/.env.dev이 없습니다. .env.example에서 복사합니다."
    cp apps/web/.env.example apps/web/.env.dev
    echo -e "${GREEN}  [OK]${NC} apps/web/.env.dev 생성됨"
fi

echo -e "${GREEN}  [OK]${NC} 환경 변수 준비됨"

# ----------------------------------------
# Node.js 의존성 설치
# ----------------------------------------
echo ""
echo -e "${BLUE}[3/3]${NC} Node.js 의존성 설치..."

pnpm install
echo -e "${GREEN}  [OK]${NC} 의존성 설치 완료"

# compose.dev.yml에서 external 네트워크를 사용하므로 없으면 생성
if ! docker network inspect angple-dev-network >/dev/null 2>&1; then
    echo -e "${BLUE}[INFO]${NC} Creating network: angple-dev-network"
    docker network create angple-dev-network >/dev/null
fi

docker compose -f compose.dev.yml up "$@"

echo -e "${GREEN}[OK]${NC} Services are up."
echo "  - Web Dev: http://localhost:3010"
echo "  - Redis: localhost:6379"
