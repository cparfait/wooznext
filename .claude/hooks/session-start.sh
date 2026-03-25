#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install npm dependencies if node_modules is missing or incomplete
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  echo "Installing npm dependencies..."
  npm install
else
  echo "Dependencies already installed."
fi

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate
