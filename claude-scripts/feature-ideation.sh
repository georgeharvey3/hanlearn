#!/bin/bash
# Feature ideation — propose high-value features as GitHub issues for review
# Usage: ./claude-scripts/feature-ideation.sh
# Outputs: GitHub issue with feature proposal (labeled 'feature-proposal')

PROGRESS_LOG="${TASK_PROGRESS_LOG:-$(cd "$(dirname "$0")/.." && pwd)/claude-tasks/logs/$(basename "$0").progress.md}"
HISTORY=$(cat "$PROGRESS_LOG" 2>/dev/null || echo "No previous runs.")
RUN_DATE=$(date '+%Y-%m-%d %H:%M')

# Query GitHub for rejected feature proposals (closed as "not planned")
REJECTED_FEATURES=$(gh api 'repos/:owner/:repo/issues?state=closed&labels=feature-proposal&per_page=50' \
  --jq '.[] | select(.state_reason == "not_planned") | "- #\(.number): \(.title)"' 2>/dev/null)

if [ -z "$REJECTED_FEATURES" ]; then
  REJECTED_SECTION="No rejected proposals on record."
else
  REJECTED_SECTION="$REJECTED_FEATURES"
fi

claude -p "## Identity

You are a product-minded engineer who thinks about user value first and implementation second.
You have empathy for language learners — their frustrations, their goals, their limited time.
You understand that the best features are often simple improvements to existing flows, not flashy new capabilities.
You are realistic about complexity and honest about trade-offs.
You propose ideas that are actionable, aligned with the roadmap, and likely to actually get built.

---

Read CLAUDE.md for full project context (especially the Prioritised Roadmap and Decision Log sections).

ALREADY PROPOSED — do NOT re-propose these features or similar variations:
$HISTORY

---

REJECTED BY MAINTAINER (closed as 'not planned' — do NOT propose these or similar ideas):
$REJECTED_SECTION

---

Your task is to propose feature ideas as GitHub issues for human review. Do NOT implement any code.

Step 1 — RESEARCH:
Explore the codebase to understand current functionality and gaps.
Consider:
- What pain points might users have?
- What features align with the 'Now' and 'Next' priorities in the roadmap?
- What small improvements could have high impact?

Step 2 — PROPOSE three high-value features:
For each proposal include:
  - **User value:** What problem does it solve for the learner?
  - **Complexity:** S (hours) / M (days) / L (week+)
  - **Implementation outline:** Which files/components would change?
  - **Alignment with roadmap:** Does it fit 'Now' or 'Next' priorities?

Avoid:
- Anything listed as 'Deferred / Won't do soon' in the roadmap
- Anything previously proposed in PREVIOUS RUNS above
- Anything in REJECTED BY MAINTAINER above (these were explicitly declined)
- Features that are similar in spirit to rejected ones (e.g. if 'weak word drill mode' was rejected, don't propose 'struggling word practice mode')
- Features that require external services or significant infrastructure

Step 3 — SELECT the best proposal:
Choose the one with the best value-to-complexity ratio.
Explain your reasoning briefly.

Step 4 — CREATE A GITHUB ISSUE:
Create an issue for the selected feature using:

gh issue create \\
  --title \"[Feature Proposal] <feature name>\" \\
  --label \"feature-proposal\" \\
  --body \"\$(cat <<'ISSUE_EOF'
## Summary
<One paragraph explaining the feature and its user value>

## User Value
<What problem does this solve? Who benefits?>

## Complexity
<S/M/L with brief justification>

## Implementation Outline
<Which files/components would change, high-level approach>

## Alignment
<How does this fit with the roadmap priorities?>

---
*Proposed by Claude Code feature ideation task*
ISSUE_EOF
)\"

Do NOT:
- Create branches
- Write any implementation code
- Create PRs

PROGRESS LOG:
After completing your work, append ONE line to $PROGRESS_LOG in this exact format:

$RUN_DATE | Proposed: [feature 1], [feature 2], [feature 3]. Created: [#N or N/A].

Example:
2026-03-09 09:27 | Proposed: struggling words indicator, quick-retry failed words, manual bank adjustment. Created: #42.

Keep it to a single line. Then trim the file so only the 10 most recent lines remain." \
  --allowedTools "Bash,Read,Write,Edit" || exit 1

echo "Feature ideation complete. Check GitHub for the new issue."
