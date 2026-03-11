#!/bin/bash

set -euo pipefail

PUBLIC_SITE_URL="${DEPLOY_SITE_URL:-https://damoang.net}"
ORIGIN_SITE_URL="${DEPLOY_ORIGIN_URL:-http://127.0.0.1:30080}"
DEFAULT_PATHS="/,/free"
MAX_ATTEMPTS="${SMOKE_TEST_ATTEMPTS:-5}"
SLEEP_SECONDS="${SMOKE_TEST_SLEEP_SECONDS:-2}"
CHECK_PUBLIC_BUNDLE="${SMOKE_TEST_CHECK_PUBLIC_BUNDLE:-0}"

if [ $# -gt 0 ]; then
    TARGETS=("$@")
else
    IFS=',' read -r -a TARGETS <<< "${DEPLOY_SMOKE_PATHS:-$DEFAULT_PATHS}"
fi

build_url() {
    local base_url="$1"
    local target="$2"
    target="$(echo "$target" | xargs)"
    if [[ "$target" =~ ^https?:// ]]; then
        printf '%s\n' "$target"
    else
        printf '%s%s\n' "${base_url%/}" "$target"
    fi
}

request_with_status() {
    local target="$1"
    curl -sS -L -w $'\n%{http_code}' "$target" || true
}

check_status() {
    local url="$1"
    local status=""
    for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
        status=$(curl -sS -o /dev/null -w "%{http_code}" "$url") || true
        if [ "$status" = "200" ]; then
            printf '%s\n' "$status"
            return 0
        fi
        [ "$attempt" -lt "$MAX_ATTEMPTS" ] && sleep "$SLEEP_SECONDS"
    done
    printf '%s\n' "${status:-000}"
    return 1
}

extract_bundle() {
    grep -oE '/_app/immutable/[^"'"'"' <>]+\.js' | head -1
}

for target in "${TARGETS[@]}"; do
    origin_url="$(build_url "$ORIGIN_SITE_URL" "$target")"
    echo "[smoke-test] checking origin HTML ${origin_url}"

    html=""
    status=""
    for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
        html=$(request_with_status "$origin_url")
        status=$(printf '%s' "$html" | tail -n 1)
        html=$(printf '%s' "$html" | sed '$d')
        if [ "$status" = "200" ]; then
            break
        fi
        [ "$attempt" -lt "$MAX_ATTEMPTS" ] && sleep "$SLEEP_SECONDS"
    done

    if [ "$status" != "200" ]; then
        echo "[smoke-test] failed: ${origin_url} returned HTTP ${status:-000}"
        exit 1
    fi

    bundle=$(printf '%s' "$html" | extract_bundle || true)
    if [ -z "$bundle" ]; then
        echo "[smoke-test] failed: could not find immutable bundle in ${origin_url}"
        exit 1
    fi

    origin_bundle_url="${ORIGIN_SITE_URL%/}${bundle}"
    if ! bundle_status=$(check_status "$origin_bundle_url"); then
        echo "[smoke-test] failed: ${origin_bundle_url} returned HTTP ${bundle_status}"
        exit 1
    fi

    echo "[smoke-test] ok: ${origin_bundle_url}"

    if [ "$CHECK_PUBLIC_BUNDLE" = "1" ]; then
        public_bundle_url="${PUBLIC_SITE_URL%/}${bundle}"
        if ! public_status=$(check_status "$public_bundle_url"); then
            echo "[smoke-test] failed: ${public_bundle_url} returned HTTP ${public_status}"
            exit 1
        fi
        echo "[smoke-test] ok: ${public_bundle_url}"
    fi
done
