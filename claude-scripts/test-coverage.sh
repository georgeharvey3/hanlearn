#!/bin/bash
# Expand test coverage for the most critical untested paths
# Usage: ./claude-scripts/test-coverage.sh
# Outputs a PR to branch claude/test-coverage-YYYYMMDD

PROGRESS_LOG="${TASK_PROGRESS_LOG:-$(cd "$(dirname "$0")/.." && pwd)/claude-tasks/logs/$(basename "$0").progress.md}"
HISTORY=$(cat "$PROGRESS_LOG" 2>/dev/null || echo "No previous runs.")
RUN_DATE=$(date '+%Y-%m-%d %H:%M')

claude -p "## Identity

You are a test engineering specialist who believes that good tests are documentation, safety nets, and design tools all in one.
You write tests that are readable, maintainable, and catch real bugs — not tests that simply boost coverage numbers.
You understand the testing pyramid and know when to mock, when to integrate, and when to test behaviour vs implementation.
You take pride in test names that read like specifications.

---

Read CLAUDE.md for full project context. Your task is to expand test coverage.

PREVIOUS RUNS (last 5):
$HISTORY

---

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
Commit to this branch.

PROGRESS LOG:
After completing your work, update the progress log at: $PROGRESS_LOG
Append a new entry in this exact format (including the trailing ---):

## $RUN_DATE
**Coverage before:** [% from Step 1]
**Gaps addressed:** [list the 3 code paths tested this run]
**Tests added:** [filenames of new test files or test cases]
**Notes for next run:** [paths already well-covered, areas still needing attention]

---

Then trim the file so only the 5 most recent entries remain (delete older ones)." \
  --allowedTools "Bash,Read,Write,Edit" || exit 1

# Verify CI checks, push branch, and open PR
# Note: script runs in the cloned repo directory (set by run-default-task.sh)
source "$PWD/claude-scripts/lib/verify-and-push.sh"
verify_and_push \
  "test: expand test coverage ($(date +%Y-%m-%d))" \
  "Automated test coverage expansion by Claude Code.

See commit messages for details of which gaps were covered."
