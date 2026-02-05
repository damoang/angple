#!/bin/bash
# ============================================
# Angple 환경 설정 초기화 스크립트
# ============================================
#
# 사용법: ./scripts/setup.sh
#
# 이 스크립트는 .env.example 파일들을 복사하여
# 로컬 개발용 .env.local 파일을 생성합니다.
# ============================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 프로젝트 루트 디렉터리
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo ""
echo "============================================"
echo "  Angple 환경 설정 초기화"
echo "============================================"
echo ""

# 함수: 파일 복사 (이미 존재하면 스킵)
copy_env_file() {
    local src="$1"
    local dest="$2"
    local name="$3"

    if [ -f "$dest" ]; then
        echo -e "${YELLOW}[SKIP]${NC} $name 이미 존재함: $dest"
    elif [ -f "$src" ]; then
        cp "$src" "$dest"
        echo -e "${GREEN}[OK]${NC}   $name 생성됨: $dest"
    else
        echo -e "${RED}[ERROR]${NC} 템플릿 없음: $src"
    fi
}

# 1. 루트 .env.local 생성
echo "1. 루트 환경 설정..."
copy_env_file "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env.local" "루트"

# 2. apps/web/.env.local 생성
echo ""
echo "2. Web 앱 환경 설정..."
copy_env_file "$PROJECT_ROOT/apps/web/.env.example" "$PROJECT_ROOT/apps/web/.env.local" "Web 앱"

# 3. apps/admin/.env.local 생성
echo ""
echo "3. Admin 앱 환경 설정..."
copy_env_file "$PROJECT_ROOT/apps/admin/.env.example" "$PROJECT_ROOT/apps/admin/.env.local" "Admin 앱"

# 4. 설정 검증
echo ""
echo "============================================"
echo "  설정 검증"
echo "============================================"
echo ""

check_port_conflict() {
    local port=$1
    local name=$2
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${YELLOW}[WARN]${NC} 포트 $port ($name) 이미 사용 중"
    else
        echo -e "${GREEN}[OK]${NC}   포트 $port ($name) 사용 가능"
    fi
}

echo "포트 상태 확인..."
check_port_conflict 3010 "Web"
check_port_conflict 3011 "Admin"
check_port_conflict 8081 "Backend API"

# 5. 완료 메시지
echo ""
echo "============================================"
echo -e "  ${GREEN}설정 완료!${NC}"
echo "============================================"
echo ""
echo "다음 명령어로 개발 서버를 시작하세요:"
echo ""
echo "  # 로컬 개발 (pnpm)"
echo "  cd apps/web && pnpm dev"
echo ""
echo "  # Docker 개발"
echo "  docker compose --env-file .env.local up -d web"
echo ""
echo "  # 접속 URL"
echo "  Web:   http://localhost:3010"
echo "  Admin: http://localhost:3011"
echo ""
