#!/bin/bash
#
# Docker 기반 무중단 배포 스크립트
#
# 사용법:
#   ./scripts/docker-deploy.sh build              # 이미지만 빌드
#   ./scripts/docker-deploy.sh web                # web.damoang.net Blue-Green 배포
#   ./scripts/docker-deploy.sh dev                # dev.damoang.net 단순 재시작 배포
#   ./scripts/docker-deploy.sh web --rollback     # 이전 슬롯으로 롤백
#   ./scripts/docker-deploy.sh status             # 현재 상태 확인
#   ./scripts/docker-deploy.sh cleanup            # 오래된 이미지 정리
#

set -euo pipefail

# ============================
# 설정
# ============================
PROJECT_DIR="/home/damoang/angple"
IMAGE_NAME="angple-web"
UPSTREAM_CONF="/etc/nginx/conf.d/angple-upstream.conf"

# 포트 할당
WEB_BLUE_PORT=3020
WEB_GREEN_PORT=3021
DEV_PORT=3030

# 컨테이너 이름
WEB_BLUE_CONTAINER="angple-web-blue"
WEB_GREEN_CONTAINER="angple-web-green"
DEV_CONTAINER="angple-dev"

# 볼륨 마운트 (공통: themes, plugins, widgets)
COMMON_VOLUMES=(
    "-v" "${PROJECT_DIR}/themes:/app/themes"
    "-v" "${PROJECT_DIR}/custom-themes:/app/custom-themes"
    "-v" "${PROJECT_DIR}/plugins:/app/plugins"
    "-v" "${PROJECT_DIR}/widgets:/app/widgets"
)

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================
# 헬퍼 함수
# ============================

log_info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# 현재 git SHA (짧은 해시)
get_git_sha() {
    cd "$PROJECT_DIR"
    git rev-parse --short HEAD
}

# 현재 활성 웹 슬롯 확인 (blue 또는 green)
get_active_slot() {
    if [ ! -f "$UPSTREAM_CONF" ]; then
        echo "none"
        return
    fi
    if grep -q "$WEB_GREEN_PORT" "$UPSTREAM_CONF"; then
        echo "green"
    elif grep -q "$WEB_BLUE_PORT" "$UPSTREAM_CONF"; then
        echo "blue"
    else
        echo "none"
    fi
}

# 컨테이너가 실행 중인지 확인
is_container_running() {
    docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null | grep -q "true"
}

# 헬스체크 대기 (최대 30초)
wait_for_health() {
    local port=$1
    local max_attempts=30
    local attempt=0

    log_info "헬스체크 대기 중 (port: $port)..."

    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "http://127.0.0.1:${port}/health" > /dev/null 2>&1; then
            log_ok "헬스체크 성공 (${attempt}초)"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done

    log_error "헬스체크 실패 (${max_attempts}초 초과)"
    return 1
}

# ============================
# 빌드
# ============================

do_build() {
    local tag="${1:-$(get_git_sha)}"

    log_info "Docker 이미지 빌드: ${IMAGE_NAME}:${tag}"

    cd "$PROJECT_DIR"
    docker build \
        -t "${IMAGE_NAME}:${tag}" \
        -t "${IMAGE_NAME}:latest" \
        --target production \
        -f apps/web/Dockerfile \
        .

    log_ok "빌드 완료: ${IMAGE_NAME}:${tag}"
}

# ============================
# Web 배포 (Blue-Green)
# ============================

do_deploy_web() {
    local rollback=false
    if [ "${1:-}" = "--rollback" ]; then
        rollback=true
    fi

    local tag
    tag="$(get_git_sha)"
    local env_file="${PROJECT_DIR}/.env.web"

    if [ ! -f "$env_file" ]; then
        log_error ".env.web 파일이 없습니다: $env_file"
        exit 1
    fi

    # 현재 활성 슬롯 확인
    local active_slot
    active_slot=$(get_active_slot)
    log_info "현재 활성 슬롯: ${active_slot}"

    if [ "$rollback" = true ]; then
        # 롤백: 현재 비활성 슬롯으로 전환 (이전 컨테이너가 아직 있어야 함)
        local rollback_slot rollback_port rollback_container
        case "$active_slot" in
            blue)
                rollback_slot="green"
                rollback_port=$WEB_GREEN_PORT
                rollback_container=$WEB_GREEN_CONTAINER
                ;;
            green)
                rollback_slot="blue"
                rollback_port=$WEB_BLUE_PORT
                rollback_container=$WEB_BLUE_CONTAINER
                ;;
            *)
                log_error "롤백할 수 없습니다 (활성 슬롯 없음)"
                exit 1
                ;;
        esac

        if ! is_container_running "$rollback_container"; then
            log_error "롤백 대상 컨테이너가 실행 중이 아닙니다: $rollback_container"
            exit 1
        fi

        # 헬스체크
        if ! wait_for_health "$rollback_port"; then
            log_error "롤백 대상이 건강하지 않습니다"
            exit 1
        fi

        # nginx 전환
        switch_upstream "$rollback_port"
        log_ok "롤백 완료: ${rollback_slot} (port: ${rollback_port})"
        return
    fi

    # 일반 배포: 빌드 → 비활성 슬롯에 배포 → 전환
    local target_slot target_port target_container old_container
    case "$active_slot" in
        blue)
            target_slot="green"
            target_port=$WEB_GREEN_PORT
            target_container=$WEB_GREEN_CONTAINER
            old_container=$WEB_BLUE_CONTAINER
            ;;
        green|none)
            target_slot="blue"
            target_port=$WEB_BLUE_PORT
            target_container=$WEB_BLUE_CONTAINER
            old_container=$WEB_GREEN_CONTAINER
            ;;
    esac

    log_info "배포 대상: ${target_slot} (port: ${target_port})"

    # 1. 이미지 빌드 (최신이 아니면)
    if ! docker image inspect "${IMAGE_NAME}:${tag}" > /dev/null 2>&1; then
        do_build "$tag"
    else
        log_info "이미지 이미 존재: ${IMAGE_NAME}:${tag}"
    fi

    # 2. 기존 target 컨테이너 정리
    if docker ps -a --format '{{.Names}}' | grep -q "^${target_container}$"; then
        log_info "기존 컨테이너 정리: ${target_container}"
        docker stop "$target_container" 2>/dev/null || true
        docker rm "$target_container" 2>/dev/null || true
    fi

    # 3. 새 컨테이너 시작
    log_info "컨테이너 시작: ${target_container}"
    docker run -d \
        --name "$target_container" \
        --network host \
        --restart unless-stopped \
        -e "PORT=${target_port}" \
        --env-file "$env_file" \
        "${COMMON_VOLUMES[@]}" \
        -v /home/damoang/angple-prod/data:/app/data \
        "${IMAGE_NAME}:${tag}"

    # 4. 헬스체크
    if ! wait_for_health "$target_port"; then
        log_error "새 컨테이너 헬스체크 실패. 컨테이너를 정리합니다."
        docker logs --tail 50 "$target_container"
        docker stop "$target_container" 2>/dev/null || true
        docker rm "$target_container" 2>/dev/null || true
        exit 1
    fi

    # 5. nginx upstream 전환
    switch_upstream "$target_port"

    # 6. 이전 컨테이너 정리 (있으면)
    if is_container_running "$old_container"; then
        log_info "이전 컨테이너 정지: ${old_container}"
        # 진행 중인 요청이 완료될 시간 확보
        sleep 3
        docker stop "$old_container" 2>/dev/null || true
        docker rm "$old_container" 2>/dev/null || true
    fi

    echo ""
    log_ok "=========================================="
    log_ok "  Web 배포 완료! (${target_slot}:${target_port})"
    log_ok "  이미지: ${IMAGE_NAME}:${tag}"
    log_ok "  web.damoang.net 확인하세요"
    log_ok "=========================================="
}

# ============================
# Dev 배포 (단순 재시작)
# ============================

do_deploy_dev() {
    local tag
    tag="$(get_git_sha)"
    local env_file="${PROJECT_DIR}/.env.dev"

    if [ ! -f "$env_file" ]; then
        log_error ".env.dev 파일이 없습니다: $env_file"
        exit 1
    fi

    # 1. 이미지 빌드 (최신이 아니면)
    if ! docker image inspect "${IMAGE_NAME}:${tag}" > /dev/null 2>&1; then
        do_build "$tag"
    else
        log_info "이미지 이미 존재: ${IMAGE_NAME}:${tag}"
    fi

    # 2. 기존 컨테이너 정리
    if docker ps -a --format '{{.Names}}' | grep -q "^${DEV_CONTAINER}$"; then
        log_info "기존 dev 컨테이너 정리"
        docker stop "$DEV_CONTAINER" 2>/dev/null || true
        docker rm "$DEV_CONTAINER" 2>/dev/null || true
    fi

    # 3. 새 컨테이너 시작
    log_info "dev 컨테이너 시작 (port: ${DEV_PORT})"
    docker run -d \
        --name "$DEV_CONTAINER" \
        --network host \
        --restart unless-stopped \
        -e "PORT=${DEV_PORT}" \
        --env-file "$env_file" \
        "${COMMON_VOLUMES[@]}" \
        -v /home/damoang/angple/data:/app/data \
        "${IMAGE_NAME}:${tag}"

    # 4. 헬스체크
    if ! wait_for_health "$DEV_PORT"; then
        log_error "dev 컨테이너 헬스체크 실패"
        docker logs --tail 50 "$DEV_CONTAINER"
        docker stop "$DEV_CONTAINER" 2>/dev/null || true
        docker rm "$DEV_CONTAINER" 2>/dev/null || true
        exit 1
    fi

    echo ""
    log_ok "=========================================="
    log_ok "  Dev 배포 완료! (port: ${DEV_PORT})"
    log_ok "  이미지: ${IMAGE_NAME}:${tag}"
    log_ok "  dev.damoang.net 확인하세요"
    log_ok "=========================================="
}

# ============================
# Nginx Upstream 전환
# ============================

switch_upstream() {
    local port=$1

    log_info "nginx upstream 전환: port ${port}"

    # upstream 파일 업데이트
    sudo tee "$UPSTREAM_CONF" > /dev/null <<EOF
# Angple Web upstream (Blue-Green 전환용)
# 이 파일은 docker-deploy.sh에 의해 자동 관리됩니다
# 마지막 전환: $(date '+%Y-%m-%d %H:%M:%S')
upstream angple_web {
    server 127.0.0.1:${port};
}
EOF

    # nginx 설정 검증 후 reload
    if sudo nginx -t 2>&1; then
        sudo nginx -s reload
        log_ok "nginx reload 완료"
    else
        log_error "nginx 설정 오류! upstream 파일을 확인하세요."
        exit 1
    fi
}

# ============================
# 상태 확인
# ============================

do_status() {
    echo -e "${BLUE}=========================================="
    echo -e "  Angple Docker 배포 상태"
    echo -e "==========================================${NC}"
    echo ""

    # Web Blue
    echo -n "  Web Blue  (${WEB_BLUE_PORT}): "
    if is_container_running "$WEB_BLUE_CONTAINER"; then
        local blue_image
        blue_image=$(docker inspect --format='{{.Config.Image}}' "$WEB_BLUE_CONTAINER" 2>/dev/null)
        echo -e "${GREEN}실행 중${NC} (${blue_image})"
    else
        echo -e "${YELLOW}중지${NC}"
    fi

    # Web Green
    echo -n "  Web Green (${WEB_GREEN_PORT}): "
    if is_container_running "$WEB_GREEN_CONTAINER"; then
        local green_image
        green_image=$(docker inspect --format='{{.Config.Image}}' "$WEB_GREEN_CONTAINER" 2>/dev/null)
        echo -e "${GREEN}실행 중${NC} (${green_image})"
    else
        echo -e "${YELLOW}중지${NC}"
    fi

    # Active slot
    local active
    active=$(get_active_slot)
    echo -e "  활성 슬롯: ${GREEN}${active}${NC}"

    echo ""

    # Dev
    echo -n "  Dev       (${DEV_PORT}): "
    if is_container_running "$DEV_CONTAINER"; then
        local dev_image
        dev_image=$(docker inspect --format='{{.Config.Image}}' "$DEV_CONTAINER" 2>/dev/null)
        echo -e "${GREEN}실행 중${NC} (${dev_image})"
    else
        echo -e "${YELLOW}중지${NC}"
    fi

    echo ""
}

# ============================
# 이미지 정리
# ============================

do_cleanup() {
    log_info "오래된 이미지 정리 중..."

    # latest와 현재 실행 중인 이미지를 제외한 나머지 삭제
    local keep_images=()

    # latest 태그
    keep_images+=("${IMAGE_NAME}:latest")

    # 실행 중인 컨테이너의 이미지
    for container in "$WEB_BLUE_CONTAINER" "$WEB_GREEN_CONTAINER" "$DEV_CONTAINER"; do
        if is_container_running "$container"; then
            local img
            img=$(docker inspect --format='{{.Config.Image}}' "$container" 2>/dev/null || true)
            if [ -n "$img" ]; then
                keep_images+=("$img")
            fi
        fi
    done

    # angple-web 이미지 목록
    local all_images
    all_images=$(docker images "${IMAGE_NAME}" --format '{{.Repository}}:{{.Tag}}' 2>/dev/null || true)

    local removed=0
    for img in $all_images; do
        local should_keep=false
        for keep in "${keep_images[@]}"; do
            if [ "$img" = "$keep" ]; then
                should_keep=true
                break
            fi
        done

        if [ "$should_keep" = false ] && [ "$img" != "${IMAGE_NAME}:<none>" ]; then
            log_info "삭제: $img"
            docker rmi "$img" 2>/dev/null || true
            removed=$((removed + 1))
        fi
    done

    if [ $removed -eq 0 ]; then
        log_info "정리할 이미지가 없습니다"
    else
        log_ok "${removed}개 이미지 정리 완료"
    fi
}

# ============================
# 메인
# ============================

case "${1:-help}" in
    build)
        do_build "${2:-}"
        ;;
    web)
        do_deploy_web "${2:-}"
        ;;
    dev)
        do_deploy_dev
        ;;
    status)
        do_status
        ;;
    cleanup)
        do_cleanup
        ;;
    help|*)
        echo "사용법: $0 {build|web|dev|status|cleanup}"
        echo ""
        echo "  build              Docker 이미지 빌드"
        echo "  web                web.damoang.net Blue-Green 배포"
        echo "  web --rollback     이전 슬롯으로 롤백"
        echo "  dev                dev.damoang.net 단순 재시작 배포"
        echo "  status             현재 상태 확인"
        echo "  cleanup            오래된 이미지 정리"
        exit 1
        ;;
esac
