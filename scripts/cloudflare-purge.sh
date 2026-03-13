#!/bin/bash

# Cloudflare Cache Purge Script
# Usage:
#   CF_API_TOKEN=xxx CF_ZONE_ID=xxx bash cloudflare-purge.sh
#   CF_API_TOKEN=xxx CF_ZONE_ID=xxx bash cloudflare-purge.sh https://damoang.net/ https://damoang.net/_app/immutable/bundle.xxx.js

set -e

DEFAULT_ENV_FILE="/home/angple/.cloudflare.env"

if { [ -z "${CF_API_TOKEN:-}" ] || [ -z "${CF_ZONE_ID:-}" ]; } && [ -f "$DEFAULT_ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$DEFAULT_ENV_FILE"
    set +a
fi

# Check required environment variables
if [ -z "${CF_API_TOKEN:-}" ]; then
    echo "Error: CF_API_TOKEN is not set"
    exit 1
fi

if [ -z "${CF_ZONE_ID:-}" ]; then
    echo "Error: CF_ZONE_ID is not set"
    exit 1
fi

echo "🔄 Purging Cloudflare cache..."
echo "Zone ID: $CF_ZONE_ID"

if [ "$#" -gt 0 ]; then
    echo "Mode: targeted purge"
    file_list=$(printf '"%s",' "$@")
    file_list="[${file_list%,}]"
    JSON_PAYLOAD="{\"files\":${file_list}}"
else
    echo "Mode: purge everything"
    JSON_PAYLOAD='{"purge_everything":true}'
fi

echo "Payload: $JSON_PAYLOAD"

# Make API request
RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$JSON_PAYLOAD")

# Check response
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Cache purge successful!"
    echo "$RESPONSE"
else
    echo "❌ Cache purge failed!"
    echo "$RESPONSE"
    exit 1
fi
