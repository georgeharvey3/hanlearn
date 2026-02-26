#!/bin/bash
# Feature ideation — propose and implement one high-value, low-complexity feature
# Usage: ./claude-scripts/feature-ideation.sh
# Outputs a PR to branch claude/feature-YYYYMMDD

claude -p "Read CLAUDE.md for full project context (especially the Prioritised Roadmap and Decision Log sections).

Step 1 — PROPOSE three high-value features that would improve the Chinese learning experience.
For each proposal include:
  - User value: what problem does it solve for the learner?
  - Complexity: S (hours) / M (days) / L (week+)
  - Implementation outline: which files/components would change?
  - Alignment with roadmap: does it fit 'Now' or 'Next' priorities?

Avoid proposing anything listed as 'Deferred / Won't do soon' in the roadmap.
Avoid re-proposing anything in the Decision Log that was previously rejected.

Step 2 — From your proposals, select the one with the best value-to-complexity ratio.
Explain your choice briefly.

Step 3 — IMPLEMENT the selected feature:
  - Write the code
  - Write tests for it (Vitest + RTL for unit/integration, or Playwright for e2e if a full flow)
  - Run the full test suite (npm run test:run) — ensure all tests pass
  - Do NOT break existing functionality

Before starting: git checkout main && git pull
Branch: claude/feature-\$(date +%Y%m%d)
Commit to this branch with a descriptive message explaining the feature and its value." \
  --allowedTools "Bash,Read,Write,Edit" || exit 1

BRANCH=$(git -C "$(dirname "$0")/.." rev-parse --abbrev-ref HEAD)
gh pr create \
  --title "feat: $(git -C "$(dirname "$0")/.." log -1 --pretty=%s)" \
  --body "Autonomous feature implementation by Claude Code.

See commit message for feature details, user value, and implementation notes." \
  --base main \
  --head "$BRANCH"
