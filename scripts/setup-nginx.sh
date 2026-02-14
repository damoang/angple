#!/bin/bash
#
# nginx 설정 파일 적용 스크립트
# Docker 기반 배포 전환 시 1회 실행
#
# 사용법: sudo ./scripts/setup-nginx.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NGINX_CONF_DIR="/etc/nginx/conf.d"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[nginx 설정 적용]${NC}"
echo ""

# 1. 백업
echo -e "1. 기존 설정 백업..."
if [ -f "${NGINX_CONF_DIR}/damoang.conf" ]; then
    cp "${NGINX_CONF_DIR}/damoang.conf" "${NGINX_CONF_DIR}/damoang.conf.bak.$(date +%Y%m%d%H%M%S)"
    echo -e "   ${GREEN}damoang.conf 백업 완료${NC}"
fi

# 2. upstream 설정 복사
echo -e "2. angple-upstream.conf 복사..."
cp "${SCRIPT_DIR}/nginx/angple-upstream.conf" "${NGINX_CONF_DIR}/angple-upstream.conf"
echo -e "   ${GREEN}완료${NC}"

# 3. damoang.conf 복사
echo -e "3. damoang.conf 복사..."
cp "${SCRIPT_DIR}/nginx/damoang.conf" "${NGINX_CONF_DIR}/damoang.conf"
echo -e "   ${GREEN}완료${NC}"

# 4. 검증
echo -e "4. nginx 설정 검증..."
if nginx -t 2>&1; then
    echo -e "   ${GREEN}설정 유효${NC}"
else
    echo -e "   ${RED}설정 오류! 백업에서 복원하세요:${NC}"
    echo -e "   cp ${NGINX_CONF_DIR}/damoang.conf.bak.* ${NGINX_CONF_DIR}/damoang.conf"
    exit 1
fi

echo ""
echo -e "${YELLOW}nginx reload는 수동으로 실행하세요:${NC}"
echo -e "  sudo nginx -s reload"
echo ""
echo -e "${GREEN}완료!${NC}"
