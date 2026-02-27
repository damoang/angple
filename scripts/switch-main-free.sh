#!/bin/bash
# ===========================================
# / (메인) + /free 게시판 SvelteKit ↔ PHP 전환
# ===========================================
#
# 사용법:
#   ./scripts/switch-main-free.sh on     ← SvelteKit 전환
#   ./scripts/switch-main-free.sh off    ← PHP 롤백
#   ./scripts/switch-main-free.sh status ← 현재 상태 확인
#
# 동작 방식:
#   off: 해당 location 블록 앞에 "# DISABLED " 접두사 추가
#   on:  "# DISABLED " 접두사 제거하여 원래 nginx 설정 복원
#
set -euo pipefail

CONF="/etc/nginx/conf.d/damoang.net.conf"

# 대상 블록 라인 범위를 찾는 패턴들
# 1) 메인 페이지: "# 메인 페이지 SvelteKit" ~ 닫는 "}"
# 2) __data.json: "# 메인 페이지 __data.json" ~ 닫는 "}"
# 3) free 게시판: FREE-SVELTE-START 내부 location 블록

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

status() {
    local disabled_count
    disabled_count=$(grep -c "# DISABLED.*location.*/" "$CONF" 2>/dev/null || true)

    if [ "$disabled_count" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  현재: PHP${NC}  (/ + /free) — ${disabled_count}개 블록 비활성화됨"
    else
        # location = / 가 활성 상태인지 확인
        if grep -q "^[[:space:]]*location = / {" "$CONF"; then
            echo -e "${GREEN}✅ 현재: SvelteKit${NC}  (/ + /free)"
        else
            echo -e "${YELLOW}⚠️  현재: PHP${NC}  (/ + /free)"
        fi
    fi
}

switch_on() {
    local disabled_count
    disabled_count=$(grep -c "# DISABLED " "$CONF" 2>/dev/null || true)

    if [ "$disabled_count" -eq 0 ]; then
        echo "이미 SvelteKit 상태입니다."
        status
        return 0
    fi

    echo -e "${BLUE}[1/3] 백업...${NC}"
    sudo cp "$CONF" "${CONF}.bak-before-on-$(date +%Y%m%d-%H%M%S)"

    echo -e "${BLUE}[2/3] SvelteKit 블록 활성화 (# DISABLED 제거)...${NC}"
    sudo sed -i 's/^# DISABLED //' "$CONF"

    echo -e "${BLUE}[3/3] nginx 검증 + reload...${NC}"
    if sudo nginx -t 2>/dev/null; then
        sudo nginx -s reload 2>/dev/null
        echo -e "\n${GREEN}✅ SvelteKit 전환 완료!${NC}"
    else
        echo -e "${RED}❌ nginx 설정 오류! 최근 백업에서 복원합니다.${NC}"
        sudo nginx -t 2>&1 | head -5
        local latest_bak
        latest_bak=$(ls -t "${CONF}.bak-before-on-"* 2>/dev/null | head -1)
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
    local disabled_count
    disabled_count=$(grep -c "# DISABLED " "$CONF" 2>/dev/null || true)

    if [ "$disabled_count" -gt 0 ]; then
        echo "이미 PHP 상태입니다."
        status
        return 0
    fi

    echo -e "${BLUE}[1/4] 백업...${NC}"
    sudo cp "$CONF" "${CONF}.bak-before-off-$(date +%Y%m%d-%H%M%S)"

    echo -e "${BLUE}[2/4] 메인 페이지 (/) 비활성화...${NC}"
    # "# 메인 페이지 SvelteKit" 주석부터 닫는 } 까지
    local start_line end_line
    start_line=$(grep -n "# 메인 페이지 SvelteKit" "$CONF" | grep -v DISABLED | head -1 | cut -d: -f1)
    if [ -n "$start_line" ]; then
        end_line=$(awk "NR>$start_line && /^[[:space:]]*\}/ {print NR; exit}" "$CONF")
        if [ -n "$end_line" ]; then
            sudo sed -i "${start_line},${end_line}s/^/# DISABLED /" "$CONF"
            echo "  → 라인 ${start_line}-${end_line} 비활성화"
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

    echo -e "${BLUE}[3/4] free 게시판 비활성화...${NC}"
    # FREE-SVELTE-START 와 FREE-SVELTE-END 사이의 location 블록
    local free_start free_end
    free_start=$(grep -n "FREE-SVELTE-START" "$CONF" | head -1 | cut -d: -f1)
    free_end=$(grep -n "FREE-SVELTE-END" "$CONF" | head -1 | cut -d: -f1)
    if [ -n "$free_start" ] && [ -n "$free_end" ]; then
        # location 라인부터 닫는 } 까지만 DISABLED 처리 (마커 주석은 유지)
        local loc_start
        loc_start=$(awk "NR>$free_start && NR<$free_end && /location/ {print NR; exit}" "$CONF")
        if [ -n "$loc_start" ]; then
            local loc_end
            loc_end=$(awk "NR>$loc_start && NR<$free_end && /^[[:space:]]*\}/ {print NR; exit}" "$CONF")
            if [ -n "$loc_end" ]; then
                sudo sed -i "${loc_start},${loc_end}s/^/# DISABLED /" "$CONF"
                echo "  → free 라인 ${loc_start}-${loc_end} 비활성화"
            fi
        fi
    fi

    echo -e "${BLUE}[4/4] nginx 검증 + reload...${NC}"
    if sudo nginx -t 2>/dev/null; then
        sudo nginx -s reload 2>/dev/null
        echo -e "\n${YELLOW}⏪ PHP 롤백 완료!${NC}"
    else
        echo -e "${RED}❌ nginx 설정 오류! 최근 백업에서 복원합니다.${NC}"
        sudo nginx -t 2>&1 | head -5
        local latest_bak
        latest_bak=$(ls -t "${CONF}.bak-before-off-"* 2>/dev/null | head -1)
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
        echo "  on     - SvelteKit 전환"
        echo "  off    - PHP 롤백"
        echo "  status - 현재 상태 확인"
        exit 1
        ;;
esac
