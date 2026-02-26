#!/bin/bash
# UI/UX review — accessibility, loading states, consistency
# Usage: ./claude-scripts/design-review.sh
# Outputs a PR to branch claude/design-review-YYYYMMDD

claude -p "Read CLAUDE.md for full project context (especially the Design Principles section).

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
- If it requires design input or is a large refactor: add a // TODO comment with details

Do NOT refactor working components or change business logic. Only fix UX issues.

Run npm run test:run after to ensure nothing is broken.

Before starting: git checkout main && git pull
Branch: claude/design-review-\$(date +%Y%m%d)
Commit all changes to this branch." \
  --allowedTools "Bash,Read,Write,Edit" || exit 1

BRANCH=$(git -C "$(dirname "$0")/.." rev-parse --abbrev-ref HEAD)
gh pr create \
  --title "ux: automated design/accessibility review ($(date +%Y-%m-%d))" \
  --body "Automated UI/UX and accessibility review by Claude Code.

See commit messages for details of each fix." \
  --base main \
  --head "$BRANCH"
