#!/bin/bash
set -euo pipefail

REPO="$1"
NUMBER="$2"
WORK_DIR="/tmp/work-${NUMBER}"

cleanup() {
  rm -rf "$WORK_DIR"
}

fail() {
  local msg="$1"
  echo "    FAILED: $msg"

  # Remove in-progress, add failed label
  gh issue edit "$NUMBER" --repo "$REPO" --remove-label "in-progress" 2>/dev/null || true
  gh issue edit "$NUMBER" --repo "$REPO" --add-label "failed" 2>/dev/null || true

  # Comment on the issue with the error
  gh issue comment "$NUMBER" --repo "$REPO" \
    --body "Claude Runner failed to process this issue.

**Error:** $msg

Remove the \`failed\` label and re-add \`dev-ready\` to retry." 2>/dev/null || true

  cleanup
  return 1
}

# ── Step 1: Claim the issue ──
echo "    Claiming issue #$NUMBER..."
gh issue edit "$NUMBER" --repo "$REPO" --add-label "in-progress" || fail "Could not add in-progress label"
gh issue edit "$NUMBER" --repo "$REPO" --remove-label "dev-ready" || fail "Could not remove dev-ready label"

# ── Step 2: Fetch issue details ──
echo "    Fetching issue details..."
TITLE=$(gh issue view "$NUMBER" --repo "$REPO" --json title --jq '.title')
BODY=$(gh issue view "$NUMBER" --repo "$REPO" --json body --jq '.body')

# ── Step 3: Clone the repo ──
echo "    Cloning repo..."
cleanup  # ensure clean slate
git clone --depth 1 "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$WORK_DIR" \
  || fail "Clone failed"
cd "$WORK_DIR"

# ── Step 4: Create branch ──
# Slugify the title: lowercase, replace non-alphanumeric with hyphens, trim
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | cut -c1-40)
BRANCH="claude/issue-${NUMBER}-${SLUG}"
echo "    Branch: $BRANCH"
git checkout -b "$BRANCH" || fail "Could not create branch $BRANCH"

# ── Step 5: Run Claude Code ──
echo "    Running Claude Code..."

PROMPT="Read CLAUDE.md for full project context and conventions.

GitHub Issue #${NUMBER}: ${TITLE}

${BODY}

Implement the changes described in the issue above. Follow all conventions in CLAUDE.md:
- Write clean, tested code
- Run tests to verify your changes (cd web-client && node node_modules/.bin/vitest run)
- Commit your changes to the current branch with a descriptive message

Important:
- Do NOT create a new branch (you are already on the correct branch)
- Do NOT push or open a PR (that is handled externally)
- Focus on implementing the issue requirements and committing working code"

claude -p "$PROMPT" \
  --dangerouslySkipPermissions \
  --allowedTools "Bash,Read,Write,Edit,Grep,Glob" \
  || fail "Claude Code exited with an error"

# ── Step 6: Check if there are commits ──
COMMIT_COUNT=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l)
if [ "$COMMIT_COUNT" -eq 0 ]; then
  fail "Claude produced no commits"
fi
echo "    Claude made $COMMIT_COUNT commit(s)."

# ── Step 7: Push the branch ──
echo "    Pushing branch..."
git push -u origin "$BRANCH" || fail "Push failed"

# ── Step 8: Open a Pull Request ──
echo "    Opening pull request..."
PR_URL=$(gh pr create \
  --repo "$REPO" \
  --head "$BRANCH" \
  --base main \
  --title "$TITLE" \
  --body "Closes #${NUMBER}

Automated implementation by Claude Code Runner.

---
*Review the changes carefully before merging.*" \
) || fail "PR creation failed"

echo "    PR opened: $PR_URL"

# ── Step 9: Update labels ──
gh issue edit "$NUMBER" --repo "$REPO" --remove-label "in-progress" 2>/dev/null || true
gh issue edit "$NUMBER" --repo "$REPO" --add-label "pr-opened" 2>/dev/null || true

# ── Cleanup ──
cleanup
echo "    Success! Issue #$NUMBER → $PR_URL"
