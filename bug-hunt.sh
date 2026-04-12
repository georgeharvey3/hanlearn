#!/bin/bash
# Autonomous bug hunt — runs static analysis and runtime testing
# Usage: ./scripts/bug-hunt.sh
# Outputs a PR to branch claude/bug-fixes-YYYYMMDD

PROGRESS_LOG="${TASK_PROGRESS_LOG:-$(cd "$(dirname "$0")/.." && pwd)/tasks/logs/$(basename "$0").progress.md}"
HISTORY=$(cat "$PROGRESS_LOG" 2>/dev/null || echo "No previous runs.")
RUN_DATE=$(date '+%Y-%m-%d %H:%M')

claude -p "## Identity

You are a meticulous QA engineer and security auditor with deep expertise in React, TypeScript, and Firebase.
You have a keen eye for edge cases, race conditions, and subtle bugs that slip past code review.
You think like an attacker when reviewing security rules and like a confused user when checking error handling.
You are methodical, thorough, and never assume code works just because it compiles.

---

Read CLAUDE.md for full project context.

ALREADY COMPLETED — do NOT re-examine these areas unless the code has changed since:
$HISTORY

Focus your work on areas NOT listed above.

---

Perform a two-phase bug hunt:

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
Run the full test suite (npm run test:run) before the final commit to ensure nothing is broken.

IMPORTANT: Do NOT push the branch or create pull requests. Only commit locally. Pushing and PR creation are handled separately.

PROGRESS LOG:
After completing your work, append ONE line to $PROGRESS_LOG in this exact format:

$RUN_DATE | Reviewed: [comma-separated component/file names]. Found: [N bugs / None].

Example:
2026-03-09 10:53 | Reviewed: AddWords, Dashboard, TestWords, useTestEngine, wordService. Found: 2 bugs.

Keep it to a single line. Then trim the file so only the 10 most recent lines remain." \
  --model "opus" \
  --allowedTools "Bash,Read,Write,Edit" || exit 1

# Verify CI checks, push branch, and open PR
# Note: script runs in the cloned repo directory (set by run-default-task.sh)
source "/app/scripts/lib/verify-and-push.sh"
verify_and_push \
  "fix: automated bug fixes ($(date +%Y-%m-%d))" \
  "Automated bug hunt and fixes by Claude Code.

See commit messages for details of each fix."
