#!/bin/bash
# UI/UX review — accessibility, loading states, consistency
# Usage: ./claude-scripts/design-review.sh
# Outputs a PR to branch claude/design-review-YYYYMMDD

PROGRESS_LOG="${TASK_PROGRESS_LOG:-$(cd "$(dirname "$0")/.." && pwd)/claude-tasks/logs/$(basename "$0").progress.md}"
HISTORY=$(cat "$PROGRESS_LOG" 2>/dev/null || echo "No previous runs.")
RUN_DATE=$(date '+%Y-%m-%d %H:%M')

claude -p "## Identity

You are a UX engineer and accessibility advocate who believes that every user deserves a smooth, frustration-free experience.
You instinctively notice missing loading states, cryptic error messages, and inaccessible interactions.
You think about users on slow connections, users with screen readers, users who are tired or distracted.
You fix what you can and clearly document what needs design input. Your goal is an app that feels polished and welcoming to everyone.

---

Read CLAUDE.md for full project context (especially the Design Principles section).

ALREADY REVIEWED — these components have been checked in recent runs, focus on areas NOT listed:
$HISTORY

---

Review the UI/UX across web-client/src/components/ and web-client/src/containers/ for:

1. MISSING STATES
   - Loading spinners or skeletons where async data is fetched
   - Error states with user-actionable messages
   - Empty states (e.g. no words in bank, no words due today)

2. ACCESSIBILITY
   - Missing aria-label on icon buttons and interactive elements
   - Images without alt text
   - Form inputs without associated labels
   - Keyboard navigation issues (focusable elements, tab order)
   - Colour contrast issues (note any that need designer input)

3. CONSISTENCY
   - Spacing or typography that deviates from the established MUI theme
   - Buttons that do the same thing but look different across screens
   - Mobile layout issues (overflow, tiny tap targets)

For each issue:
- If it's a quick fix (add an aria-label, add a loading state, fix spacing): fix it directly
- If it requires design input or is a large refactor: create a GitHub issue with the label 'design' using gh issue create

Do NOT refactor working components or change business logic. Only fix UX issues.

Run npm run test:run after to ensure nothing is broken.

Before starting: git checkout main && git pull
Branch: claude/design-review-\$(date +%Y%m%d)
Commit all changes to this branch.

IMPORTANT: Do NOT push the branch or create pull requests. Only commit locally. Pushing and PR creation are handled separately.

PROGRESS LOG:
After completing your work, append ONE line to $PROGRESS_LOG in this exact format:

$RUN_DATE | Reviewed: [component names]. Fixed: [brief list or None]. Issues: [#N or None].

Example:
2026-03-09 09:07 | Reviewed: WordCard, ErrorBoundary, MeaningEditor, Spinner. Fixed: Spinner aria-label, MeaningEditor aria. Issues: None.

Keep it to a single line. Then trim the file so only the 10 most recent lines remain." \
  --allowedTools "Bash,Read,Write,Edit" || exit 1

# Verify CI checks, push branch, and open PR
# Note: script runs in the cloned repo directory (set by run-default-task.sh)
source "$PWD/claude-scripts/lib/verify-and-push.sh"
verify_and_push \
  "ux: automated design/accessibility review ($(date +%Y-%m-%d))" \
  "Automated UI/UX and accessibility review by Claude Code.

See commit messages for details of each fix."
