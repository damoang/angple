#!/bin/bash
# CI Frontend deployment script
# Usage: ./scripts/deploy-ci.sh <release_tag>
# Example: ./scripts/deploy-ci.sh deploy-20260228-123456

set -e

RELEASE_TAG="${1:-latest}"
REPO="damoang/angple"
WEB_DIR="/home/angple/web/apps/web"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$WEB_DIR"

echo "=== Frontend CI Deploy Script ==="
echo "Release: $RELEASE_TAG"
echo ""

# Download build tarball
echo "Downloading build..."
gh release download "$RELEASE_TAG" --repo "$REPO" --pattern "build.tar.gz" -D /tmp --clobber

# Extract
echo "Extracting..."
tar -xzf /tmp/build.tar.gz -C .

# Restart PM2
echo "Restarting app..."
pm2 restart angple-web 2>/dev/null || pm2 start ecosystem.config.cjs

echo "Purging Cloudflare HTML cache..."
"$SCRIPT_DIR/cloudflare-purge.sh"

echo "Running external smoke test..."
"$SCRIPT_DIR/smoke-test.sh"

# Cleanup
rm -f /tmp/build.tar.gz

echo ""
echo "=== Deploy completed at $(date) ==="
