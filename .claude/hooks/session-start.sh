#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "Session start: static HTML/CSS/JS project — no dependencies to install."
echo "Project files:"
ls "$CLAUDE_PROJECT_DIR"/*.html "$CLAUDE_PROJECT_DIR"/css/ "$CLAUDE_PROJECT_DIR"/js/ 2>/dev/null || true
