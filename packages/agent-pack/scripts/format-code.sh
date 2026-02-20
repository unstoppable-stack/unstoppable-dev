#!/bin/bash
# Auto-format after file edits (Cursor plugin hook)

FILE="$CURSOR_FILEPATH"

if [ -z "$FILE" ]; then
  exit 0
fi

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md)
    npx prettier --write "$FILE" 2>/dev/null || true
    ;;
esac
