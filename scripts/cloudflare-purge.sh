#!/bin/bash

set -euo pipefail

SITE_URL="${DEPLOY_SITE_URL:-https://damoang.net}"
DEFAULT_PATHS="/,/free"

if [ $# -gt 0 ]; then
    URLS=("$@")
elif [ -n "${DEPLOY_PURGE_URLS:-}" ]; then
    IFS=',' read -r -a URLS <<< "$DEPLOY_PURGE_URLS"
else
    IFS=',' read -r -a PATHS <<< "${DEPLOY_PURGE_PATHS:-$DEFAULT_PATHS}"
    URLS=()
    for path in "${PATHS[@]}"; do
        path="$(echo "$path" | xargs)"
        [ -z "$path" ] && continue
        if [[ "$path" =~ ^https?:// ]]; then
            URLS+=("$path")
        else
            URLS+=("${SITE_URL%/}${path}")
        fi
    done
fi

if [ -z "${CF_API_TOKEN:-}" ] || [ -z "${CF_ZONE_ID:-}" ]; then
    echo "[cloudflare-purge] skipped: CF_API_TOKEN or CF_ZONE_ID is not set"
    exit 0
fi

if [ ${#URLS[@]} -eq 0 ]; then
    echo "[cloudflare-purge] skipped: no URLs to purge"
    exit 0
fi

payload='{"files":['
for url in "${URLS[@]}"; do
    escaped=$(printf '%s' "$url" | sed 's/\\/\\\\/g; s/"/\\"/g')
    payload="${payload}\"${escaped}\","
done
payload="${payload%,}]}"

response=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$payload")

if ! printf '%s' "$response" | grep -q '"success":true'; then
    echo "[cloudflare-purge] failed: $response"
    exit 1
fi

echo "[cloudflare-purge] purged ${#URLS[@]} URL(s)"
