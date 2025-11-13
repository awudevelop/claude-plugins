#!/bin/bash

###############################################################################
# Session Plugin Hooks Cleanup Script
#
# This standalone script removes session plugin hooks from .claude/settings.json
# Can be run manually even if the plugin is partially broken or uninstalled
#
# Usage:
#   ./cleanup-hooks.sh
#
# Location:
#   Run from the plugin directory or specify project root as argument
###############################################################################

set -e

# Determine project root (where .claude/settings.json lives)
PROJECT_ROOT="${1:-$(pwd)}"

# Determine plugin root (where this script lives)
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Paths
CLI_TOOL="${PLUGIN_ROOT}/cli/session-cli.js"
SETTINGS_FILE="${PROJECT_ROOT}/.claude/settings.json"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Session Plugin Hooks Cleanup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Project Root: ${PROJECT_ROOT}"
echo "Plugin Root:  ${PLUGIN_ROOT}"
echo "Settings:     ${SETTINGS_FILE}"
echo ""

# Check if CLI tool exists
if [ ! -f "${CLI_TOOL}" ]; then
  echo "❌ Error: CLI tool not found at ${CLI_TOOL}"
  echo "💡 This script must be run from the plugin directory"
  exit 1
fi

# Check if settings.json exists
if [ ! -f "${SETTINGS_FILE}" ]; then
  echo "ℹ️  No settings.json found at ${SETTINGS_FILE}"
  echo "💡 Nothing to clean up"
  exit 0
fi

echo "🔍 Checking for session plugin hooks..."
echo ""

# Run the CLI cleanup command
node "${CLI_TOOL}" setup-hooks --remove --project-root "${PROJECT_ROOT}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Cleanup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 You can now safely uninstall the session plugin"
echo "💡 Backup saved: ${SETTINGS_FILE}.backup"
echo ""
