#!/bin/bash
set -euo pipefail

REPO="$1"
PR_NUMBER="$2"
WORK_DIR="/tmp/pr-feedback-${PR_NUMBER}"

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
  gh pr comment "$PR_NUMBER" --repo "$REPO" --body "## PR Feedback Processing Failed

**Error:** $msg

---
*To retry, ensure the \`PR-feedback\` label is present. The agent will try again on the next poll.*" 2>&1 || true

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

# ── Step 2: Fetch PR review comments (unresolved only) ──
log "Step 2: Fetching PR comments..."

# Fetch review comments (inline code comments)
REVIEW_COMMENTS=$(gh api "repos/${REPO}/pulls/${PR_NUMBER}/comments" --jq '
  [.[] | select(.in_reply_to_id == null) | {
    id: .id,
    path: .path,
    line: .line,
    body: .body,
    user: .user.login,
    created_at: .created_at
  }]' 2>/dev/null || echo "[]")

# Fetch issue comments (general PR comments, not inline)
ISSUE_COMMENTS=$(gh api "repos/${REPO}/issues/${PR_NUMBER}/comments" --jq '
  [.[] | {
    id: .id,
    body: .body,
    user: .user.login,
    created_at: .created_at
  }]' 2>/dev/null || echo "[]")

# Filter out bot comments and old comments (keep only recent actionable feedback)
# We'll pass all comments to Claude and let it determine what needs addressing
REVIEW_COUNT=$(echo "$REVIEW_COMMENTS" | jq 'length')
ISSUE_COUNT=$(echo "$ISSUE_COMMENTS" | jq 'length')

log "  Found $REVIEW_COUNT review comments and $ISSUE_COUNT general comments"

# Check if there are any comments to process
TOTAL_COMMENTS=$((REVIEW_COUNT + ISSUE_COUNT))
if [ "$TOTAL_COMMENTS" -eq 0 ]; then
  log "No comments found on PR - removing PR-feedback label"
  gh pr edit "$PR_NUMBER" --repo "$REPO" --remove-label "PR-feedback" 2>&1 || true
  exit 0
fi

# ── Step 3: Claim the PR ──
log "Step 3: Claiming PR (adding in-progress label)..."
if ! gh pr edit "$PR_NUMBER" --repo "$REPO" --add-label "in-progress" 2>&1; then
  fail "Could not add in-progress label"
fi
if ! gh pr edit "$PR_NUMBER" --repo "$REPO" --remove-label "PR-feedback" 2>&1; then
  fail "Could not remove PR-feedback label"
fi
log "PR claimed successfully."

# ── Step 4: Clone the repo ──
log "Step 4: Cloning repo..."
cleanup  # ensure clean slate
if ! git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$WORK_DIR" 2>&1; then
  fail "Clone failed"
fi
cd "$WORK_DIR"
log "Cloned to $WORK_DIR"

# ── Step 5: Checkout the PR branch ──
log "Step 5: Checking out PR branch..."
git fetch origin "$SOURCE_BRANCH" 2>&1
git checkout "$SOURCE_BRANCH" 2>&1
log "  Checked out $SOURCE_BRANCH"

# Get current commit for later comparison
ORIGINAL_COMMIT=$(git rev-parse HEAD)
log "  Current HEAD: ${ORIGINAL_COMMIT:0:8}"

# ── Step 6: Run Claude Code to address feedback ──
log "Step 6: Running Claude Code to address feedback..."

# Format comments for the prompt
FORMATTED_REVIEW_COMMENTS=$(echo "$REVIEW_COMMENTS" | jq -r '
  if length == 0 then "No inline review comments."
  else .[] | "### \(.path):\(.line // "general")\n**@\(.user):** \(.body)\n"
  end')

FORMATTED_ISSUE_COMMENTS=$(echo "$ISSUE_COMMENTS" | jq -r '
  if length == 0 then "No general comments."
  else .[] | "### General comment\n**@\(.user):** \(.body)\n"
  end')

PROMPT="Read CLAUDE.md for full project context and conventions.

You are addressing PR feedback for PR #${PR_NUMBER}: ${PR_TITLE}

## PR Description

${PR_BODY}
${ISSUE_CONTEXT}

## Review Comments (Inline)

${FORMATTED_REVIEW_COMMENTS}

## General Comments

${FORMATTED_ISSUE_COMMENTS}

## Instructions

1. Read through all the feedback comments above
2. For each piece of actionable feedback:
   - Understand what change is being requested
   - Make the necessary code changes
   - If a comment is just a question or acknowledgment (not requesting changes), skip it
3. After making changes, verify they work:
   - Run: cd web-client && npm install && npm run lint && npm run format:check && npm run build
   - Run tests if relevant: cd web-client && npm test -- --run
4. Fix any lint, format, or build errors introduced by your changes
5. Commit your changes with a clear message summarizing what feedback you addressed

## Critical Rules

- Focus on actionable feedback that requests code changes
- Ignore comments that are just acknowledgments, questions, or discussions
- Do NOT change code that wasn't mentioned in the feedback
- Maintain the original intent of the PR while incorporating feedback
- All CI checks must pass after your changes

When finished, all feedback should be addressed and the code should build successfully."

log "Prompt length: ${#PROMPT} chars"
log "Starting Claude Code CLI with model: $MODEL..."

set +e
CLAUDE_OUTPUT=$(claude -p "$PROMPT" \
  --model "$MODEL" \
  --dangerously-skip-permissions \
  --allowed-tools "Bash,Read,Write,Edit,Grep,Glob" 2>&1)
CLAUDE_EXIT=$?
set -e

if [ $CLAUDE_EXIT -ne 0 ]; then
  log "Claude Code exited with code $CLAUDE_EXIT"
  # Check if any commits were made despite the error
  CURRENT_COMMIT=$(git rev-parse HEAD)
  if [ "$CURRENT_COMMIT" = "$ORIGINAL_COMMIT" ]; then
    fail "Claude Code failed to address feedback (exit code $CLAUDE_EXIT)"
  fi
  log "Claude made commits before failing - continuing..."
fi

# ── Step 7: Verify changes ──
log "Step 7: Verifying changes..."

CURRENT_COMMIT=$(git rev-parse HEAD)
if [ "$CURRENT_COMMIT" = "$ORIGINAL_COMMIT" ]; then
  log "No changes were made - feedback may not have required code changes"
  # Still consider this a success - Claude determined no changes were needed
else
  log "  New HEAD: ${CURRENT_COMMIT:0:8}"
  COMMITS_ADDED=$(git log --oneline "${ORIGINAL_COMMIT}..HEAD" | wc -l)
  log "  Commits added: $COMMITS_ADDED"
fi

# ── Step 8: Verify build passes ──
log "Step 8: Verifying build..."
cd "$WORK_DIR/web-client"

set +e
INSTALL_OUTPUT=$(npm install --cache "$WORK_DIR/.npm-cache" 2>&1)
INSTALL_EXIT=$?
set -e

if [ $INSTALL_EXIT -ne 0 ]; then
  log "npm install output:"
  echo "$INSTALL_OUTPUT"
  fail "npm install failed (exit code $INSTALL_EXIT)"
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

  FIX_PROMPT="The CI checks are failing after addressing PR feedback. Fix all errors.
${ERRORS}

## Instructions:
1. Read the error messages and fix each issue
2. For lint errors: fix the code issues, or run 'cd web-client && npm run lint:fix'
3. For format errors: run 'cd web-client && npm run format' to auto-fix formatting
4. For build errors: fix the TypeScript/compilation issues
5. Verify all checks pass:
   cd web-client && npm run lint && npm run format:check && npm run build
6. Commit your fixes with: git commit -am \"fix: resolve lint/format errors\"

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

# ── Step 9: Push changes ──
FINAL_COMMIT=$(git rev-parse HEAD)
if [ "$FINAL_COMMIT" != "$ORIGINAL_COMMIT" ]; then
  log "Step 9: Pushing changes..."
  if ! git push origin "$SOURCE_BRANCH" 2>&1; then
    fail "Push failed"
  fi
  log "Changes pushed successfully."

  COMMITS_PUSHED=$(git log --oneline "${ORIGINAL_COMMIT}..HEAD" | wc -l)
  CHANGES_SUMMARY=$(git log --oneline "${ORIGINAL_COMMIT}..HEAD")
else
  log "Step 9: No changes to push."
  COMMITS_PUSHED=0
  CHANGES_SUMMARY="No code changes were needed."
fi

# ── Step 10: Update PR ──
log "Step 10: Updating PR..."
gh pr edit "$PR_NUMBER" --repo "$REPO" --remove-label "in-progress" 2>&1 || true

# Post success comment
if [ "$COMMITS_PUSHED" -gt 0 ]; then
  gh pr comment "$PR_NUMBER" --repo "$REPO" --body "## PR Feedback Addressed

I've reviewed and addressed the feedback on this PR.

**Commits added:** ${COMMITS_PUSHED}

\`\`\`
${CHANGES_SUMMARY}
\`\`\`

All CI checks are passing. Ready for re-review." 2>&1 || true
else
  gh pr comment "$PR_NUMBER" --repo "$REPO" --body "## PR Feedback Reviewed

I've reviewed all the feedback on this PR and determined that no code changes were needed. The feedback may have been:
- Questions or discussions (not actionable requests)
- Already addressed in previous commits
- Acknowledgments or approvals

Please re-add the \`PR-feedback\` label if there's specific feedback you'd like me to address." 2>&1 || true
fi

log "PR updated."

# ── Cleanup ──
cleanup
log "SUCCESS! PR #$PR_NUMBER feedback addressed"
