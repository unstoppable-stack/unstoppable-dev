#!/bin/bash
# Auto-format hook for PostToolUse (Edit|Write)
# Formats TypeScript/JavaScript files after Claude edits them
# Used in .claude/settings.json hooks

FILE="$CLAUDE_FILE"

if [ -z "$FILE" ]; then
  exit 0
fi

# Only format supported file types
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md)
    npx prettier --write "$FILE" 2>/dev/null || true
    ;;
esac
