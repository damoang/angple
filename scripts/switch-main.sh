#!/bin/bash
# ===========================================
# / (메인 페이지만) SvelteKit ↔ PHP 전환
# ===========================================
#
# 사용법:
#   ./scripts/switch-main.sh on     ← SvelteKit 전환
#   ./scripts/switch-main.sh off    ← PHP 롤백
#   ./scripts/switch-main.sh status ← 현재 상태 확인
#
set -euo pipefail

CONF="/etc/nginx/conf.d/damoang.net.conf"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

status() {
    local main_disabled data_disabled
    main_disabled=$(grep -c "# DISABLED.*location = / {" "$CONF" 2>/dev/null || true)
    data_disabled=$(grep -c "# DISABLED.*location = /__data.json" "$CONF" 2>/dev/null || true)

    if [ "$main_disabled" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  현재: PHP${NC}  (/ 메인 페이지)"
    elif grep -q "^[[:space:]]*location = / {" "$CONF"; then
        echo -e "${GREEN}✅ 현재: SvelteKit${NC}  (/ 메인 페이지)"
    else
        echo -e "${YELLOW}⚠️  현재: PHP${NC}  (/ 메인 페이지)"
    fi
}

switch_on() {
    local main_disabled
    main_disabled=$(grep -c "# DISABLED.*location = / {" "$CONF" 2>/dev/null || true)

    if [ "$main_disabled" -eq 0 ]; then
        echo "이미 SvelteKit 상태입니다."
        status
        return 0
    fi

    echo -e "${BLUE}[1/3] 백업...${NC}"
    sudo cp "$CONF" "${CONF}.bak-before-main-on-$(date +%Y%m%d-%H%M%S)"

    echo -e "${BLUE}[2/3] 메인 페이지 블록 활성화...${NC}"
    # "# 메인 페이지 SvelteKit" 블록 활성화
    local start_line end_line
    start_line=$(grep -n "# DISABLED.*# 메인 페이지 SvelteKit" "$CONF" | head -1 | cut -d: -f1)
    if [ -n "$start_line" ]; then
        end_line=$(awk "NR>=$start_line && /# DISABLED.*\}/ {last=NR} END {print last}" "$CONF")
        # 연속된 DISABLED 블록의 끝을 찾음 (빈 줄 전까지)
        end_line=$(awk "NR>=$start_line {if (/^# DISABLED/) last=NR; else if (last) {print last; exit}}" "$CONF")
        if [ -n "$end_line" ]; then
            sudo sed -i "${start_line},${end_line}s/^# DISABLED //" "$CONF"
            echo "  → 메인 페이지 라인 ${start_line}-${end_line} 활성화"
        fi
    fi

    # __data.json 블록 활성화
    start_line=$(grep -n "# DISABLED.*# 메인 페이지 __data.json" "$CONF" | head -1 | cut -d: -f1)
    if [ -n "$start_line" ]; then
        end_line=$(awk "NR>=$start_line {if (/^# DISABLED/) last=NR; else if (last) {print last; exit}}" "$CONF")
        if [ -n "$end_line" ]; then
            sudo sed -i "${start_line},${end_line}s/^# DISABLED //" "$CONF"
            echo "  → __data.json 라인 ${start_line}-${end_line} 활성화"
        fi
    fi

    echo -e "${BLUE}[3/3] nginx 검증 + reload...${NC}"
    if sudo nginx -t 2>/dev/null; then
        sudo nginx -s reload 2>/dev/null
        echo -e "\n${GREEN}✅ SvelteKit 전환 완료!${NC} (/ 메인 페이지)"
    else
        echo -e "${RED}❌ nginx 설정 오류! 백업에서 복원합니다.${NC}"
        sudo nginx -t 2>&1 | head -5
        local latest_bak
        latest_bak=$(ls -t "${CONF}.bak-before-main-on-"* 2>/dev/null | head -1)
        if [ -n "$latest_bak" ]; then
            sudo cp "$latest_bak" "$CONF"
            sudo nginx -s reload 2>/dev/null
            echo "백업에서 복원 완료: $latest_bak"
        fi
        exit 1
    fi
    status
}

switch_off() {
    local main_disabled
    main_disabled=$(grep -c "# DISABLED.*location = / {" "$CONF" 2>/dev/null || true)

    if [ "$main_disabled" -gt 0 ]; then
        echo "이미 PHP 상태입니다."
        status
        return 0
    fi

    echo -e "${BLUE}[1/3] 백업...${NC}"
    sudo cp "$CONF" "${CONF}.bak-before-main-off-$(date +%Y%m%d-%H%M%S)"

    echo -e "${BLUE}[2/3] 메인 페이지 블록 비활성화...${NC}"
    # "# 메인 페이지 SvelteKit" 주석부터 닫는 } 까지
    local start_line end_line
    start_line=$(grep -n "# 메인 페이지 SvelteKit" "$CONF" | grep -v DISABLED | head -1 | cut -d: -f1)
    if [ -n "$start_line" ]; then
        end_line=$(awk "NR>$start_line && /^[[:space:]]*\}/ {print NR; exit}" "$CONF")
        if [ -n "$end_line" ]; then
            sudo sed -i "${start_line},${end_line}s/^/# DISABLED /" "$CONF"
            echo "  → 메인 페이지 라인 ${start_line}-${end_line} 비활성화"
        fi
    fi

    # __data.json 블록
    start_line=$(grep -n "# 메인 페이지 __data.json" "$CONF" | grep -v DISABLED | head -1 | cut -d: -f1)
    if [ -n "$start_line" ]; then
        end_line=$(awk "NR>$start_line && /^[[:space:]]*\}/ {print NR; exit}" "$CONF")
        if [ -n "$end_line" ]; then
            sudo sed -i "${start_line},${end_line}s/^/# DISABLED /" "$CONF"
            echo "  → __data.json 라인 ${start_line}-${end_line} 비활성화"
        fi
    fi

    echo -e "${BLUE}[3/3] nginx 검증 + reload...${NC}"
    if sudo nginx -t 2>/dev/null; then
        sudo nginx -s reload 2>/dev/null
        echo -e "\n${YELLOW}⏪ PHP 롤백 완료!${NC} (/ 메인 페이지)"
    else
        echo -e "${RED}❌ nginx 설정 오류! 백업에서 복원합니다.${NC}"
        sudo nginx -t 2>&1 | head -5
        local latest_bak
        latest_bak=$(ls -t "${CONF}.bak-before-main-off-"* 2>/dev/null | head -1)
        if [ -n "$latest_bak" ]; then
            sudo cp "$latest_bak" "$CONF"
            sudo nginx -s reload 2>/dev/null
            echo "백업에서 복원 완료: $latest_bak"
        fi
        exit 1
    fi
    status
}

case "${1:-status}" in
    on)     switch_on ;;
    off)    switch_off ;;
    status) status ;;
    *)
        echo "사용법: $0 {on|off|status}"
        echo "  on     - / 메인 페이지 SvelteKit 전환"
        echo "  off    - / 메인 페이지 PHP 롤백"
        echo "  status - 현재 상태 확인"
        exit 1
        ;;
esac
