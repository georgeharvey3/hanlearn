#!/bin/bash
# Claude Code PreToolUse hook: auto-format staged files before git commit
# Reads tool input from stdin, checks if it's a git commit command,
# and runs prettier on staged .ts/.tsx/.css/.json files first.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only intercept git commit commands
if [[ "$COMMAND" =~ git[[:space:]]+(commit|am) ]]; then
  cd "$(dirname "$0")/../../web-client" || exit 0

  # Get staged files that prettier cares about
  STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM -- 'src/**/*.ts' 'src/**/*.tsx' 'src/**/*.css' 'src/**/*.json' 2>/dev/null)

  if [ -n "$STAGED_FILES" ]; then
    # Run prettier on staged files
    echo "$STAGED_FILES" | xargs npx prettier --config .prettierrc --write 2>/dev/null

    # Re-stage the formatted files
    echo "$STAGED_FILES" | xargs git add
  fi
fi

exit 0
