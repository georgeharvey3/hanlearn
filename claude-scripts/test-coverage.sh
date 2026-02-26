#!/bin/bash
# Expand test coverage for the most critical untested paths
# Usage: ./claude-scripts/test-coverage.sh
# Outputs a PR to branch claude/test-coverage-YYYYMMDD

claude -p "Read CLAUDE.md for full project context. Your task is to expand test coverage.

Step 1 — Run the current test suite with coverage:
  cd web-client && npm run test:coverage

Step 2 — Identify the 3 most critical untested code paths.
Prioritise in this order:
  1. User-facing flows that touch Firestore (word add/remove/fetch, test scoring)
  2. Spaced repetition logic (bank advancement, due date calculation)
  3. Auth flows (login, logout, signup, auth state persistence)
Deprioritise: pure styling, static display components, legacy api/ directory.

Step 3 — Write tests for those 3 gaps using Vitest + React Testing Library.
Use web-client/src/test/utils.tsx for render helpers.
Mock Firebase service calls at the service layer (not the SDK).

Step 4 — Run all tests again and ensure they pass (npm run test:run).

Before starting: git checkout main && git pull
Branch: claude/test-coverage-\$(date +%Y%m%d)
Commit to this branch." \
  --allowedTools "Bash,Read,Write,Edit" || exit 1

# Open PR after Claude finishes
BRANCH=$(git -C "$(dirname "$0")/.." rev-parse --abbrev-ref HEAD)
gh pr create \
  --title "test: expand test coverage ($(date +%Y-%m-%d))" \
  --body "Automated test coverage expansion by Claude Code.

See commit messages for details of which gaps were covered." \
  --base main \
  --head "$BRANCH"
