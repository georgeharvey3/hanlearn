#!/bin/bash
# Autonomous bug hunt — runs static analysis and runtime testing
# Usage: ./claude-scripts/bug-hunt.sh
# Outputs a PR to branch claude/bug-fixes-YYYYMMDD

claude -p "Read CLAUDE.md for full project context. Perform a two-phase bug hunt:

PHASE 1 — STATIC ANALYSIS:
Review the entire codebase (web-client/src/, functions/src/, firestore.rules) for:
- Logic errors and off-by-one bugs
- Unhandled promise rejections and missing error boundaries
- Firebase security rule gaps (check firestore.rules carefully)
- Race conditions in state updates or async operations
- Incorrect TypeScript types or unsafe casts
- Missing loading/error states in components

PHASE 2 — RUNTIME:
Start Firebase emulators (npm run emulators from repo root) and the dev server
(npm run dev:client). Run the existing test suite (cd web-client && npm run test:run).
Report any test failures.

For each bug found:
- Fix it in place
- Add a regression test if applicable
- Include a clear description in the commit message

Before starting: git checkout main && git pull
Branch: claude/bug-fixes-\$(date +%Y%m%d)
Commit all fixes to this branch with a summary commit message.
Run the full test suite (npm run test:run) before the final commit to ensure nothing is broken." \
  --allowedTools "Bash,Read,Write,Edit" || exit 1

BRANCH=$(git -C "$(dirname "$0")/.." rev-parse --abbrev-ref HEAD)
gh pr create \
  --title "fix: automated bug fixes ($(date +%Y-%m-%d))" \
  --body "Automated bug hunt and fixes by Claude Code.

See commit messages for details of each fix." \
  --base main \
  --head "$BRANCH"
