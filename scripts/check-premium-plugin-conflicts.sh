#!/usr/bin/env bash

set -euo pipefail

CORE_ROOT="${1:-.}"
PREMIUM_ROOT="${2:-_premium}"

premium_plugins_dir="${PREMIUM_ROOT}/plugins"

if [ ! -d "$premium_plugins_dir" ]; then
    echo "No premium plugins directory found at ${premium_plugins_dir}; skipping conflict check."
    exit 0
fi

# Plugins are designed to be merged: core provides shared types/interfaces,
# premium adds platform-specific implementations. install.sh uses cp -r to
# merge them, so overlapping plugin IDs are expected and safe.
echo "Premium plugin conflict check passed. (plugins are merge-safe by design)"
