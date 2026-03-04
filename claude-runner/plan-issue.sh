#!/bin/bash
set -euo pipefail

REPO="$1"
NUMBER="$2"
WORK_DIR="/tmp/plan-${NUMBER}"

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

  # Remove in-progress, restore needs-plan so it can be retried
  log "Updating issue labels (removing in-progress, restoring needs-plan)..."
  gh issue edit "$NUMBER" --repo "$REPO" --remove-label "in-progress" 2>&1 || true
  gh issue edit "$NUMBER" --repo "$REPO" --add-label "needs-plan" 2>&1 || true

  cleanup
  return 1
}

# ── Step 1: Claim the issue ──
log "Step 1: Claiming issue #$NUMBER for planning..."
if ! gh issue edit "$NUMBER" --repo "$REPO" --add-label "in-progress" 2>&1; then
  fail "Could not add in-progress label"
fi
if ! gh issue edit "$NUMBER" --repo "$REPO" --remove-label "needs-plan" 2>&1; then
  fail "Could not remove needs-plan label"
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
log "Step 3: Cloning repo for context..."
cleanup  # ensure clean slate
if ! git clone --depth 1 "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$WORK_DIR" 2>&1; then
  fail "Clone failed"
fi
cd "$WORK_DIR"
log "Cloned to $WORK_DIR"

# ── Step 4: Run Claude Code in plan mode ──
log "Step 4: Running Claude Code to generate implementation plan..."

COMMENTS_SECTION=""
if [ -n "$COMMENTS" ]; then
  COMMENTS_SECTION="

## Comments

${COMMENTS}"
fi

PROMPT="Read CLAUDE.md for full project context and conventions.

GitHub Issue #${NUMBER}: ${TITLE}

${BODY}${COMMENTS_SECTION}

Your task is to create a detailed implementation plan for this issue. Do NOT implement anything - only plan.

Analyze the codebase and create a comprehensive implementation plan that includes:
1. Summary of what needs to be done
2. Files that will need to be modified or created
3. Step-by-step implementation tasks
4. Testing approach
5. Any potential risks or considerations

Write your plan to a file called IMPLEMENTATION_PLAN.md in the root directory.
Format it as clean markdown that can be posted as a GitHub comment.
Do NOT include any code fences around the entire plan - just use them for code snippets within the plan.

Important:
- Do NOT implement any code changes
- Do NOT create branches or commits
- ONLY create the IMPLEMENTATION_PLAN.md file with your analysis and plan"

log "Prompt length: ${#PROMPT} chars"
log "Starting Claude Code CLI with model: $MODEL..."
if ! claude -p "$PROMPT" \
  --model "$MODEL" \
  --dangerously-skip-permissions \
  --allowed-tools "Bash,Read,Write,Edit,Grep,Glob" 2>&1; then
  fail "Claude Code exited with an error"
fi
log "Claude Code completed."

# ── Step 5: Check for plan output ──
log "Step 5: Checking for implementation plan..."
if [ ! -f "IMPLEMENTATION_PLAN.md" ]; then
  fail "Claude did not create IMPLEMENTATION_PLAN.md"
fi
log "Found IMPLEMENTATION_PLAN.md"

# ── Step 6: Post plan as comment ──
log "Step 6: Posting implementation plan as comment..."
PLAN_CONTENT=$(cat IMPLEMENTATION_PLAN.md)
COMMENT_BODY="## Implementation Plan

${PLAN_CONTENT}

---
*This plan was generated automatically by Claude Code Runner. Once approved, add the \`dev-ready\` label to begin implementation.*"

if ! gh issue comment "$NUMBER" --repo "$REPO" --body "$COMMENT_BODY" 2>&1; then
  fail "Could not post comment to issue"
fi
log "Plan posted as comment."

# ── Step 7: Update labels ──
log "Step 7: Removing in-progress label..."
gh issue edit "$NUMBER" --repo "$REPO" --remove-label "in-progress" 2>&1 || true
log "Label removed."

# ── Cleanup ──
cleanup
log "SUCCESS! Implementation plan posted to issue #$NUMBER"
