#!/bin/bash
set -euo pipefail

REPO="$1"
NUMBER="$2"
WORK_DIR="/tmp/work-${NUMBER}"

# Log function with timestamp
log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')]     $*"
}

log_error() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')]     ERROR: $*"
}

cleanup() {
  rm -rf "$WORK_DIR"
}

fail() {
  local msg="$1"
  log_error "FAILED: $msg"

  # Post failure comment to the issue
  log "Posting failure comment..."
  gh issue comment "$NUMBER" --repo "$REPO" --body "## Agent Failed

**Error:** $msg

---
*To retry, remove the \`agent-failed\` label and add \`dev-ready\`.*" 2>&1 || true

  # Remove in-progress, add agent-failed for review
  log "Updating issue labels (removing in-progress, adding agent-failed)..."
  gh issue edit "$NUMBER" --repo "$REPO" --remove-label "in-progress" 2>&1 || true
  gh issue edit "$NUMBER" --repo "$REPO" --add-label "agent-failed" 2>&1 || true

  cleanup
  return 1
}

# ── Step 1: Claim the issue ──
log "Step 1: Claiming issue #$NUMBER..."
if ! gh issue edit "$NUMBER" --repo "$REPO" --add-label "in-progress" 2>&1; then
  fail "Could not add in-progress label"
fi
if ! gh issue edit "$NUMBER" --repo "$REPO" --remove-label "dev-ready" 2>&1; then
  fail "Could not remove dev-ready label"
fi
log "Issue claimed successfully."

# ── Step 2: Fetch issue details ──
log "Step 2: Fetching issue details..."
if ! TITLE=$(gh issue view "$NUMBER" --repo "$REPO" --json title --jq '.title' 2>&1); then
  fail "Could not fetch issue title: $TITLE"
fi
log "  Title: $TITLE"

if ! BODY=$(gh issue view "$NUMBER" --repo "$REPO" --json body --jq '.body' 2>&1); then
  fail "Could not fetch issue body: $BODY"
fi
log "  Body: $(echo "$BODY" | head -c 100)..."

COMMENTS=$(gh issue view "$NUMBER" --repo "$REPO" --json comments \
  --jq '.comments[] | "**\(.author.login):** \(.body)"' 2>/dev/null | paste -sd $'\n\n' - || echo "")
if [ -n "$COMMENTS" ]; then
  log "  Comments: found"
else
  log "  Comments: none"
fi

# Check for model override via labels
LABELS=$(gh issue view "$NUMBER" --repo "$REPO" --json labels --jq '.labels[].name' 2>/dev/null || echo "")
if echo "$LABELS" | grep -q "^sonnet$"; then
  MODEL="sonnet"
  log "  Model: Sonnet (via label)"
else
  MODEL="opus"
  log "  Model: Opus (default)"
fi

# ── Step 3: Clone the repo ──
log "Step 3: Cloning repo..."
cleanup  # ensure clean slate
if ! git clone --depth 1 "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$WORK_DIR" 2>&1; then
  fail "Clone failed"
fi
cd "$WORK_DIR"
log "Cloned to $WORK_DIR"

# ── Step 4: Create branch ──
log "Step 4: Creating branch..."
# Slugify the title: lowercase, replace non-alphanumeric with hyphens, trim
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | cut -c1-40)
BRANCH="claude/issue-${NUMBER}-${SLUG}"
log "  Branch name: $BRANCH"
if ! git checkout -b "$BRANCH" 2>&1; then
  fail "Could not create branch $BRANCH"
fi
log "Branch created successfully."

# ── Step 5: Run Claude Code ──
log "Step 5: Running Claude Code..."

COMMENTS_SECTION=""
if [ -n "$COMMENTS" ]; then
  COMMENTS_SECTION="

## Comments

${COMMENTS}"
fi

PROMPT="Read CLAUDE.md for full project context and conventions.

GitHub Issue #${NUMBER}: ${TITLE}

${BODY}${COMMENTS_SECTION}

Implement the changes described in the issue above. Follow all conventions in CLAUDE.md:
- Write clean, tested code
- Run tests to verify your changes (cd web-client && node node_modules/.bin/vitest run)
- Commit your changes to the current branch with a descriptive message

Important:
- Do NOT create a new branch (you are already on the correct branch)
- Do NOT push or open a PR (that is handled externally)
- Focus on implementing the issue requirements and committing working code
- There may be an implementation plan in the comments. If so, follow that plan closely. If not, create your own implementation plan based on the issue description and comments, and execute it.

When you are finished, write a file called PR_DESCRIPTION.md with a detailed description of the changes you made. This will be used as the pull request body. Include:
- A summary of what was changed and why
- Key implementation details
- Any decisions or trade-offs you made
- Files modified"

log "Prompt length: ${#PROMPT} chars"
log "Starting Claude Code CLI with model: $MODEL..."
if ! claude -p "$PROMPT" \
  --model "$MODEL" \
  --dangerously-skip-permissions \
  --allowed-tools "Bash,Read,Write,Edit,Grep,Glob" 2>&1; then
  fail "Claude Code exited with an error"
fi
log "Claude Code completed."

# ── Step 6: Check if there are commits ──
log "Step 6: Checking for commits..."
COMMIT_COUNT=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l || echo "0")
if [ "$COMMIT_COUNT" -eq 0 ]; then
  fail "Claude produced no commits"
fi
log "Claude made $COMMIT_COUNT commit(s)."

# ── Step 7: Verify CI checks pass ──
log "Step 7: Verifying CI checks..."
cd "$WORK_DIR/web-client"

# Install dependencies
log "  Installing dependencies..."
if ! npm install --cache "$WORK_DIR/.npm-cache" 2>&1; then
  fail "npm install failed"
fi

# Run lint check
log "  Running lint..."
set +e
LINT_OUTPUT=$(npm run lint 2>&1)
LINT_EXIT=$?
set -e

# Run format check
log "  Running format check..."
set +e
FORMAT_OUTPUT=$(npm run format:check 2>&1)
FORMAT_EXIT=$?
set -e

# Run build
log "  Running build..."
set +e
BUILD_OUTPUT=$(npm run build 2>&1)
BUILD_EXIT=$?
set -e

# If any check failed, invoke Claude to fix
if [ $LINT_EXIT -ne 0 ] || [ $FORMAT_EXIT -ne 0 ] || [ $BUILD_EXIT -ne 0 ]; then
  log "CI checks failed - invoking Claude to fix..."

  ERRORS=""
  if [ $LINT_EXIT -ne 0 ]; then
    ERRORS="${ERRORS}

## Lint errors (npm run lint):
${LINT_OUTPUT}"
  fi
  if [ $FORMAT_EXIT -ne 0 ]; then
    ERRORS="${ERRORS}

## Format errors (npm run format:check):
${FORMAT_OUTPUT}"
  fi
  if [ $BUILD_EXIT -ne 0 ]; then
    ERRORS="${ERRORS}

## Build errors (npm run build):
${BUILD_OUTPUT}"
  fi

  cd "$WORK_DIR"

  FIX_PROMPT="The CI checks are failing. Fix all errors before the code can be pushed.
${ERRORS}

## Instructions:
1. Read the error messages and fix each issue
2. For lint errors: fix the code issues, or if available run 'cd web-client && npm run lint:fix'
3. For format errors: run 'cd web-client && npm run format' to auto-fix formatting
4. For build errors: fix the TypeScript/compilation issues
5. Verify all checks pass:
   cd web-client && npm run lint && npm run format:check && npm run build
6. Commit your fixes with: git commit -am \"fix: resolve lint/format/build errors\"

All checks must pass before you're done."

  if ! claude -p "$FIX_PROMPT" \
    --model "$MODEL" \
    --dangerously-skip-permissions \
    --allowed-tools "Bash,Read,Write,Edit,Grep,Glob" 2>&1; then
    fail "Claude Code failed to fix CI errors"
  fi

  # Verify all checks pass now
  cd "$WORK_DIR/web-client"
  if ! npm run lint 2>&1; then
    fail "Lint still failing after fix attempt"
  fi
  if ! npm run format:check 2>&1; then
    fail "Format check still failing after fix attempt"
  fi
  if ! npm run build 2>&1; then
    fail "Build still failing after fix attempt"
  fi

  log "CI checks fixed successfully."
else
  log "All CI checks passed."
fi

cd "$WORK_DIR"

# ── Step 8: Push the branch ──
log "Step 8: Pushing branch..."
if ! git push -u origin "$BRANCH" 2>&1; then
  fail "Push failed"
fi
log "Branch pushed successfully."

# ── Step 9: Open a Pull Request ──
log "Step 9: Opening pull request..."

# Read PR description from file if Claude created it
if [ -f "PR_DESCRIPTION.md" ]; then
  log "  Found PR_DESCRIPTION.md, using it for PR body"
  PR_BODY=$(cat PR_DESCRIPTION.md)
  # Remove the file so it's not committed
  rm -f PR_DESCRIPTION.md
else
  log "  No PR_DESCRIPTION.md found, using default body"
  PR_BODY="Automated implementation by Claude Code Runner."
fi

# Append footer
PR_BODY="${PR_BODY}

---
Closes #${NUMBER}"

if ! PR_URL=$(gh pr create \
  --repo "$REPO" \
  --head "$BRANCH" \
  --base main \
  --title "$TITLE" \
  --body "$PR_BODY" 2>&1); then
  fail "PR creation failed: $PR_URL"
fi
log "PR opened: $PR_URL"

# ── Step 10: Update labels ──
log "Step 10: Removing in-progress label..."
gh issue edit "$NUMBER" --repo "$REPO" --remove-label "in-progress" 2>&1 || true
log "Label removed."

# ── Cleanup ──
cleanup
log "SUCCESS! Issue #$NUMBER → $PR_URL"
