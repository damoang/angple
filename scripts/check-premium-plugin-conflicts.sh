#!/usr/bin/env bash

set -euo pipefail

CORE_ROOT="${1:-.}"
PREMIUM_ROOT="${2:-_premium}"

core_plugins_dir="${CORE_ROOT}/plugins"
premium_plugins_dir="${PREMIUM_ROOT}/plugins"

if [ ! -d "$premium_plugins_dir" ]; then
    echo "No premium plugins directory found at ${premium_plugins_dir}; skipping conflict check."
    exit 0
fi

conflicts=()

while IFS= read -r premium_plugin; do
    plugin_name="$(basename "$premium_plugin")"
    if [ -d "${core_plugins_dir}/${plugin_name}" ]; then
        conflicts+=("$plugin_name")
    fi
done < <(find "$premium_plugins_dir" -mindepth 1 -maxdepth 1 -type d | sort)

if [ "${#conflicts[@]}" -gt 0 ]; then
    echo "FATAL: premium plugin overwrite conflict detected."
    echo "The following plugin ids exist in both core and premium:"
    printf ' - %s\n' "${conflicts[@]}"
    echo "Premium plugins must not overwrite core plugins. Move the implementation to a private-only plugin id or remove the duplicate premium plugin."
    exit 1
fi

echo "Premium plugin conflict check passed."
