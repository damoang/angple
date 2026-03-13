#!/bin/bash

# Cloudflare R2 bootstrap helper
# Usage:
#   bash cloudflare-r2-bootstrap.sh
#   R2_BUCKET_NAME=my-bucket bash cloudflare-r2-bootstrap.sh

set -euo pipefail

DEFAULT_ENV_FILE="/home/angple/.cloudflare.env"
R2_BUCKET_NAME="${R2_BUCKET_NAME:-damoang-web-assets}"

if [ -f "$DEFAULT_ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$DEFAULT_ENV_FILE"
    set +a
fi

for name in CF_API_TOKEN CF_ACCOUNT_ID; do
    if [ -z "${!name:-}" ]; then
        echo "Error: ${name} is not set"
        exit 1
    fi
done

api() {
    local method=$1
    local path=$2
    local data=${3:-}

    if [ -n "$data" ]; then
        curl -sS -X "$method" "https://api.cloudflare.com/client/v4${path}" \
            -H "Authorization: Bearer ${CF_API_TOKEN}" \
            -H "Content-Type: application/json" \
            --data "$data"
    else
        curl -sS -X "$method" "https://api.cloudflare.com/client/v4${path}" \
            -H "Authorization: Bearer ${CF_API_TOKEN}" \
            -H "Content-Type: application/json"
    fi
}

echo "== Verify token =="
api GET "/user/tokens/verify"
echo
echo

echo "== Existing R2 buckets =="
api GET "/accounts/${CF_ACCOUNT_ID}/r2/buckets"
echo
echo

echo "== Create bucket: ${R2_BUCKET_NAME} =="
api POST "/accounts/${CF_ACCOUNT_ID}/r2/buckets" "{\"name\":\"${R2_BUCKET_NAME}\"}"
echo
echo

cat <<EOF
If bucket creation succeeded, the next manual step is creating S3-compatible R2 credentials
with object-read/object-write access for bucket: ${R2_BUCKET_NAME}.

GitHub Secrets to set afterwards:
  CLOUDFLARE_R2_ACCOUNT_ID=${CF_ACCOUNT_ID}
  CLOUDFLARE_R2_BUCKET=${R2_BUCKET_NAME}
  CLOUDFLARE_R2_ACCESS_KEY_ID=<R2 S3 access key id>
  CLOUDFLARE_R2_SECRET_ACCESS_KEY=<R2 S3 secret access key>
EOF
