#!/bin/bash
set -euo pipefail

REPO="$1"
PR_NUMBER="$2"
WORK_DIR="/tmp/conflict-pr-${PR_NUMBER}"

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

  # Post failure comment to the PR
  log "Posting failure comment..."
  gh pr comment "$PR_NUMBER" --repo "$REPO" --body "## Conflict Resolution Failed

**Error:** $msg

---
*To retry, ensure the \`fix-conflict\` label is present. The agent will try again on the next poll.*" 2>&1 || true

  # Add agent-failed label for visibility
  log "Adding agent-failed label..."
  gh pr edit "$PR_NUMBER" --repo "$REPO" --add-label "agent-failed" 2>&1 || true

  cleanup
  return 1
}

# ── Step 1: Fetch PR details ──
log "Step 1: Fetching PR #$PR_NUMBER details..."

PR_DATA=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json headRefName,baseRefName,title,body,number 2>&1) || {
  fail "Could not fetch PR details"
}

SOURCE_BRANCH=$(echo "$PR_DATA" | jq -r '.headRefName')
TARGET_BRANCH=$(echo "$PR_DATA" | jq -r '.baseRefName')
PR_TITLE=$(echo "$PR_DATA" | jq -r '.title')
PR_BODY=$(echo "$PR_DATA" | jq -r '.body')

log "  Title: $PR_TITLE"
log "  Source branch: $SOURCE_BRANCH"
log "  Target branch: $TARGET_BRANCH"

# Extract linked issue number from PR body (looks for "Closes #123" or "Fixes #123")
LINKED_ISSUE=""
if echo "$PR_BODY" | grep -qiE '(closes|fixes|resolves)\s*#[0-9]+'; then
  LINKED_ISSUE=$(echo "$PR_BODY" | grep -oiE '(closes|fixes|resolves)\s*#[0-9]+' | head -1 | grep -oE '[0-9]+')
  log "  Linked issue: #$LINKED_ISSUE"
fi

# Fetch linked issue details for context
ISSUE_CONTEXT=""
if [ -n "$LINKED_ISSUE" ]; then
  log "  Fetching linked issue details..."
  ISSUE_TITLE=$(gh issue view "$LINKED_ISSUE" --repo "$REPO" --json title --jq '.title' 2>/dev/null || echo "")
  ISSUE_BODY=$(gh issue view "$LINKED_ISSUE" --repo "$REPO" --json body --jq '.body' 2>/dev/null || echo "")
  if [ -n "$ISSUE_TITLE" ]; then
    ISSUE_CONTEXT="
## Original Task (Issue #${LINKED_ISSUE})

**Title:** ${ISSUE_TITLE}

**Description:**
${ISSUE_BODY}"
  fi
fi

# Check for model override via labels
LABELS=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json labels --jq '.labels[].name' 2>/dev/null || echo "")
if echo "$LABELS" | grep -q "^sonnet$"; then
  MODEL="sonnet"
  log "  Model: Sonnet (via label)"
else
  MODEL="opus"
  log "  Model: Opus (default)"
fi

# ── Step 2: Claim the PR ──
log "Step 2: Claiming PR (adding in-progress label)..."
if ! gh pr edit "$PR_NUMBER" --repo "$REPO" --add-label "in-progress" 2>&1; then
  fail "Could not add in-progress label"
fi
if ! gh pr edit "$PR_NUMBER" --repo "$REPO" --remove-label "fix-conflict" 2>&1; then
  fail "Could not remove fix-conflict label"
fi
log "PR claimed successfully."

# ── Step 3: Clone the repo with full history ──
log "Step 3: Cloning repo (full history for rebase)..."
cleanup  # ensure clean slate
if ! git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$WORK_DIR" 2>&1; then
  fail "Clone failed"
fi
cd "$WORK_DIR"
log "Cloned to $WORK_DIR"

# ── Step 4: Setup branches ──
log "Step 4: Setting up branches..."
git fetch origin "$SOURCE_BRANCH" "$TARGET_BRANCH" 2>&1
git checkout "$SOURCE_BRANCH" 2>&1
log "  Checked out $SOURCE_BRANCH"

# Get commit count for later verification
ORIGINAL_COMMIT_COUNT=$(git log --oneline "origin/${TARGET_BRANCH}..HEAD" | wc -l)
log "  Commits to rebase: $ORIGINAL_COMMIT_COUNT"

if [ "$ORIGINAL_COMMIT_COUNT" -eq 0 ]; then
  log "No commits to rebase - branch is up to date with $TARGET_BRANCH"
  gh pr edit "$PR_NUMBER" --repo "$REPO" --remove-label "in-progress" 2>&1 || true
  cleanup
  exit 0
fi

# ── Step 5: Attempt rebase ──
log "Step 5: Attempting rebase onto $TARGET_BRANCH..."
set +e
REBASE_OUTPUT=$(git rebase "origin/${TARGET_BRANCH}" 2>&1)
REBASE_EXIT=$?
set -e

if [ $REBASE_EXIT -eq 0 ]; then
  log "Rebase completed without conflicts!"
else
  log "Rebase has conflicts - invoking Claude to resolve..."

  # Get list of conflicted files
  CONFLICTED_FILES=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "")
  if [ -z "$CONFLICTED_FILES" ]; then
    # Try alternate method
    CONFLICTED_FILES=$(git status --porcelain | grep "^UU\|^AA\|^DD" | awk '{print $2}' || echo "")
  fi

  log "  Conflicted files:"
  echo "$CONFLICTED_FILES" | while read -r f; do [ -n "$f" ] && log "    - $f"; done

  # Get the diff of what we're trying to apply
  BRANCH_CHANGES=$(git log --oneline "origin/${TARGET_BRANCH}..REBASE_HEAD" 2>/dev/null || echo "No commit log available")

  # ── Step 6: Run Claude Code to resolve conflicts ──
  log "Step 6: Running Claude Code to resolve conflicts..."

  PROMPT="Read CLAUDE.md for full project context and conventions.

You are resolving git merge conflicts for PR #${PR_NUMBER}: ${PR_TITLE}

## Situation

This PR's branch (\`${SOURCE_BRANCH}\`) has conflicts when rebasing onto \`${TARGET_BRANCH}\`. Your job is to resolve these conflicts while preserving the intent of the PR changes.
${ISSUE_CONTEXT}

## PR Description

${PR_BODY}

## Commits being rebased

${BRANCH_CHANGES}

## Conflicted files

${CONFLICTED_FILES}

## Instructions

1. For each conflicted file, read the file to see the conflict markers
2. Understand what the PR was trying to change vs what changed in ${TARGET_BRANCH}
3. Resolve each conflict by keeping the intent of the PR changes while incorporating any necessary updates from ${TARGET_BRANCH}
4. After resolving a file, stage it with: git add <filename>
5. After ALL conflicts are resolved, continue the rebase with: git rebase --continue
6. If there are more conflicts in subsequent commits, resolve those too
7. Repeat until the rebase is complete

## Critical Rules

- PRESERVE the goals of the original task/issue - the PR changes should still work after rebasing
- DO NOT lose any functionality that the PR was adding
- If ${TARGET_BRANCH} changed something the PR also changed, prefer the PR's version unless it would break the code
- Make sure the code compiles/works after resolution
- Run tests if appropriate: cd web-client && npm test -- --run

When finished, the rebase should be complete and all conflicts resolved.

After the rebase is complete, verify the build passes:
1. cd web-client && npm install && npm run build
2. If there are lint errors or build failures, fix them
3. Commit any fixes with a message like \"fix: resolve lint errors after rebase\"

The branch must build successfully before you're done."

  log "Prompt length: ${#PROMPT} chars"
  log "Starting Claude Code CLI with model: $MODEL..."

  if ! claude -p "$PROMPT" \
    --model "$MODEL" \
    --dangerously-skip-permissions \
    --allowed-tools "Bash,Read,Write,Edit,Grep,Glob" 2>&1; then
    # Check if rebase was completed despite error
    if git status 2>/dev/null | grep -q "rebase in progress"; then
      git rebase --abort 2>/dev/null || true
      fail "Claude Code failed to resolve conflicts"
    fi
  fi

  # Verify rebase is complete
  if git status 2>/dev/null | grep -q "rebase in progress"; then
    git rebase --abort 2>/dev/null || true
    fail "Rebase still in progress after Claude - conflicts not fully resolved"
  fi

  log "Claude completed conflict resolution."
fi

# ── Step 7: Verify the rebase ──
log "Step 7: Verifying rebase..."
NEW_COMMIT_COUNT=$(git log --oneline "origin/${TARGET_BRANCH}..HEAD" | wc -l)
log "  Commits after rebase: $NEW_COMMIT_COUNT (was $ORIGINAL_COMMIT_COUNT)"

if [ "$NEW_COMMIT_COUNT" -eq 0 ]; then
  fail "Rebase resulted in no commits - something went wrong"
fi

# ── Step 8: Verify build passes ──
log "Step 8: Verifying build..."
cd "$WORK_DIR/web-client"

set +e
# Use local cache to avoid permission issues with global npm cache
INSTALL_OUTPUT=$(npm install --cache "$WORK_DIR/.npm-cache" 2>&1)
INSTALL_EXIT=$?
set -e

if [ $INSTALL_EXIT -ne 0 ]; then
  log "npm install output:"
  echo "$INSTALL_OUTPUT"
  fail "npm install failed after rebase (exit code $INSTALL_EXIT)"
fi
log "  Dependencies installed."

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
  log "Checks failed - invoking Claude to fix..."

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

  FIX_PROMPT="The CI checks are failing after the rebase. Fix all errors.
${ERRORS}

## Instructions:
1. Read the error messages and fix each issue
2. For lint errors: fix the code issues, or if available run 'cd web-client && npm run lint:fix'
3. For format errors: run 'cd web-client && npm run format' to auto-fix formatting
4. For build errors: fix the TypeScript/compilation issues
5. Verify all checks pass:
   cd web-client && npm run lint && npm run format:check && npm run build
6. Commit your fixes with: git commit -am \"fix: resolve lint/format errors after rebase\"

All checks must pass before you're done."

  if ! claude -p "$FIX_PROMPT" \
    --model "$MODEL" \
    --dangerously-skip-permissions \
    --allowed-tools "Bash,Read,Write,Edit,Grep,Glob" 2>&1; then
    fail "Claude Code failed to fix errors"
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

  log "All checks fixed successfully."
else
  log "All checks passed."
fi

cd "$WORK_DIR"

# ── Step 9: Force push the rebased branch ──
log "Step 9: Force pushing rebased branch..."
if ! git push --force-with-lease origin "$SOURCE_BRANCH" 2>&1; then
  fail "Force push failed"
fi
log "Branch force-pushed successfully."

# ── Step 10: Update PR ──
log "Step 10: Updating PR labels..."
gh pr edit "$PR_NUMBER" --repo "$REPO" --remove-label "in-progress" 2>&1 || true

# Post success comment
gh pr comment "$PR_NUMBER" --repo "$REPO" --body "## Conflicts Resolved

Successfully rebased \`${SOURCE_BRANCH}\` onto \`${TARGET_BRANCH}\`.

- **Commits rebased:** ${NEW_COMMIT_COUNT}
- **Method:** $([ $REBASE_EXIT -eq 0 ] && echo "Clean rebase (no conflicts)" || echo "AI-assisted conflict resolution")

The branch is now up to date and ready for review." 2>&1 || true

log "Labels updated."

# ── Cleanup ──
cleanup
log "SUCCESS! PR #$PR_NUMBER rebased and conflicts resolved"
