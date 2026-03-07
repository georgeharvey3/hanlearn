#!/bin/bash
set -euo pipefail

REPO="georgeharvey3/hanlearn"
POLL_INTERVAL=120  # seconds
ACTIVITY_LOG="/app/claude-tasks/logs/activity.log"
ERROR_LOG="/app/claude-tasks/logs/error.log"
ISSUE_OUTPUT="/tmp/issue-output.log"

# Ensure log directory exists
mkdir -p "$(dirname "$ACTIVITY_LOG")"

# Log to stdout
log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*"
}

log_error() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ERROR: $*"
}

# Log to activity file (persistent, one line per action)
activity() {
  local timestamp
  timestamp=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
  echo "[$timestamp] $*" >> "$ACTIVITY_LOG"
  # Keep only last 500 lines
  tail -n 500 "$ACTIVITY_LOG" > "$ACTIVITY_LOG.tmp" && mv "$ACTIVITY_LOG.tmp" "$ACTIVITY_LOG"
}

# Log error details to error log (last N lines of output)
log_error_details() {
  local task_id="$1"
  local exit_code="$2"
  local output_file="$3"
  local max_lines="${4:-100}"

  local timestamp
  timestamp=$(date -u '+%Y-%m-%d %H:%M:%S UTC')

  {
    echo "═══════════════════════════════════════════════════════════════════"
    echo "[$timestamp] $task_id — exit code $exit_code"
    echo "═══════════════════════════════════════════════════════════════════"
    if [ -f "$output_file" ]; then
      echo "Last $max_lines lines of output:"
      echo "───────────────────────────────────────────────────────────────────"
      tail -n "$max_lines" "$output_file"
    else
      echo "(no output captured)"
    fi
    echo ""
  } >> "$ERROR_LOG"

  # Keep error log under 5000 lines
  if [ -f "$ERROR_LOG" ]; then
    tail -n 5000 "$ERROR_LOG" > "$ERROR_LOG.tmp" && mv "$ERROR_LOG.tmp" "$ERROR_LOG"
  fi
}

# Check for incomplete tasks from previous run (container was killed/crashed)
check_incomplete_tasks() {
  if [ ! -f "$ACTIVITY_LOG" ]; then
    return
  fi

  # Get the last non-empty line in the activity log
  local last_entry
  last_entry=$(tail -1 "$ACTIVITY_LOG" | grep -v '^$' || true)

  if [ -z "$last_entry" ]; then
    return
  fi

  # If the last entry is a "start" entry (TASK/WORKING/PLANNING without a symbol prefix),
  # it means the task was interrupted before completion
  local task_id
  if echo "$last_entry" | grep -qE '^\[.*\] TASK [^ ]+'; then
    task_id=$(echo "$last_entry" | sed -E 's/.*TASK ([^ ]+).*/\1/')
    activity "⚠ ABORTED $task_id — container stopped during execution"
    log "Detected incomplete task from previous run: $task_id (marked as aborted)"
  elif echo "$last_entry" | grep -qE '^\[.*\] WORKING #[0-9]+'; then
    task_id=$(echo "$last_entry" | sed -E 's/.*WORKING (#[0-9]+).*/\1/')
    activity "⚠ ABORTED $task_id — container stopped during execution"
    log "Detected incomplete issue from previous run: $task_id (marked as aborted)"
  elif echo "$last_entry" | grep -qE '^\[.*\] PLANNING #[0-9]+'; then
    task_id=$(echo "$last_entry" | sed -E 's/.*PLANNING (#[0-9]+).*/\1/')
    activity "⚠ ABORTED $task_id — container stopped during execution"
    log "Detected incomplete planning from previous run: $task_id (marked as aborted)"
  elif echo "$last_entry" | grep -qE '^\[.*\] REBASING PR#[0-9]+'; then
    task_id=$(echo "$last_entry" | sed -E 's/.*REBASING (PR#[0-9]+).*/\1/')
    activity "⚠ ABORTED $task_id — container stopped during execution"
    log "Detected incomplete rebase from previous run: $task_id (marked as aborted)"
  elif echo "$last_entry" | grep -qE '^\[.*\] FEEDBACK PR#[0-9]+'; then
    task_id=$(echo "$last_entry" | sed -E 's/.*FEEDBACK (PR#[0-9]+).*/\1/')
    activity "⚠ ABORTED $task_id — container stopped during execution"
    log "Detected incomplete PR feedback from previous run: $task_id (marked as aborted)"
  fi
}

echo "=== HanLearn Claude Runner ==="
echo "Repo: $REPO"
echo "Polling every ${POLL_INTERVAL}s"
echo "Priority: fix-conflict PRs > PR-feedback PRs > dev-ready issues > needs-plan issues > default tasks"
echo ""

# Verify credentials
log "Checking environment variables..."
if [ -z "${GITHUB_TOKEN:-}" ]; then
  log_error "GITHUB_TOKEN is not set"
  exit 1
fi
log "  GITHUB_TOKEN: set (${#GITHUB_TOKEN} chars)"

if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  log_error "CLAUDE_CODE_OAUTH_TOKEN is not set"
  exit 1
fi
log "  CLAUDE_CODE_OAUTH_TOKEN: set (${#CLAUDE_CODE_OAUTH_TOKEN} chars)"

# Verify gh CLI can authenticate (GITHUB_TOKEN env var is used automatically)
log "Verifying GitHub CLI authentication..."
if ! gh auth status 2>&1; then
  log_error "GitHub CLI authentication failed - check GITHUB_TOKEN"
  exit 1
fi
log "GitHub CLI authenticated successfully."
echo ""

# Check for tasks that were interrupted when container last stopped
check_incomplete_tasks

while true; do
  # ══════════════════════════════════════════════════════════════════════════════
  # PRIORITY 1: Check for PRs with "fix-conflict" label (conflict resolution)
  # ══════════════════════════════════════════════════════════════════════════════
  CONFLICT_PRS_RAW=$(gh pr list \
    --repo "$REPO" \
    --search "label:fix-conflict is:open sort:created-desc" \
    --json number,title,labels \
    --limit 10 2>&1) || true

  # Validate JSON
  if ! echo "$CONFLICT_PRS_RAW" | jq empty 2>/dev/null; then
    log_error "Invalid JSON response from gh pr list (fix-conflict)"
    CONFLICT_PRS="[]"
  else
    CONFLICT_PRS="$CONFLICT_PRS_RAW"
  fi

  # Filter out PRs that have "in-progress" or "agent-failed" labels
  CONFLICT_PRS=$(echo "$CONFLICT_PRS" | jq '[.[] | select(.labels | map(.name) | (index("in-progress") or index("agent-failed")) | not)]' 2>/dev/null || echo "[]")

  CONFLICT_COUNT=$(echo "$CONFLICT_PRS" | jq 'length' 2>/dev/null || echo "0")

  if [ "$CONFLICT_COUNT" -gt 0 ]; then
    # Process the oldest conflict PR (only one at a time)
    PR_NUMBER=$(echo "$CONFLICT_PRS" | jq -r '.[0].number')
    PR_TITLE=$(echo "$CONFLICT_PRS" | jq -r '.[0].title')

    activity "REBASING PR#$PR_NUMBER"
    log "── Conflict Resolution PR #$PR_NUMBER: $PR_TITLE ──"

    # Capture output for error logging
    set +e
    /app/fix-conflict-pr.sh "$REPO" "$PR_NUMBER" 2>&1 | tee "$ISSUE_OUTPUT"
    CONFLICT_EXIT=${PIPESTATUS[0]}
    set -e

    if [ "$CONFLICT_EXIT" -eq 0 ]; then
      activity "✓ REBASED PR#$PR_NUMBER"
      log "── PR #$PR_NUMBER conflict resolution completed ──"
    else
      activity "✗ REBASED PR#$PR_NUMBER — exit $CONFLICT_EXIT"
      log_error "── PR #$PR_NUMBER conflict resolution failed ──"
      log_error_details "REBASING PR#$PR_NUMBER" "$CONFLICT_EXIT" "$ISSUE_OUTPUT"
      log "Error details written to: $ERROR_LOG"
    fi
    rm -f "$ISSUE_OUTPUT"

    sleep "$POLL_INTERVAL"
    continue
  fi

  # ══════════════════════════════════════════════════════════════════════════════
  # PRIORITY 2: Check for PRs with "PR-feedback" label (address review comments)
  # ══════════════════════════════════════════════════════════════════════════════
  FEEDBACK_PRS_RAW=$(gh pr list \
    --repo "$REPO" \
    --search "label:PR-feedback is:open sort:created-desc" \
    --json number,title,labels \
    --limit 10 2>&1) || true

  # Validate JSON
  if ! echo "$FEEDBACK_PRS_RAW" | jq empty 2>/dev/null; then
    log_error "Invalid JSON response from gh pr list (PR-feedback)"
    FEEDBACK_PRS="[]"
  else
    FEEDBACK_PRS="$FEEDBACK_PRS_RAW"
  fi

  # Filter out PRs that have "in-progress" or "agent-failed" labels
  FEEDBACK_PRS=$(echo "$FEEDBACK_PRS" | jq '[.[] | select(.labels | map(.name) | (index("in-progress") or index("agent-failed")) | not)]' 2>/dev/null || echo "[]")

  FEEDBACK_COUNT=$(echo "$FEEDBACK_PRS" | jq 'length' 2>/dev/null || echo "0")

  if [ "$FEEDBACK_COUNT" -gt 0 ]; then
    # Process the oldest feedback PR (only one at a time)
    PR_NUMBER=$(echo "$FEEDBACK_PRS" | jq -r '.[0].number')
    PR_TITLE=$(echo "$FEEDBACK_PRS" | jq -r '.[0].title')

    activity "FEEDBACK PR#$PR_NUMBER"
    log "── PR Feedback #$PR_NUMBER: $PR_TITLE ──"

    # Capture output for error logging
    set +e
    /app/handle-pr-feedback.sh "$REPO" "$PR_NUMBER" 2>&1 | tee "$ISSUE_OUTPUT"
    FEEDBACK_EXIT=${PIPESTATUS[0]}
    set -e

    if [ "$FEEDBACK_EXIT" -eq 0 ]; then
      activity "✓ FEEDBACK PR#$PR_NUMBER"
      log "── PR #$PR_NUMBER feedback addressed ──"
    else
      activity "✗ FEEDBACK PR#$PR_NUMBER — exit $FEEDBACK_EXIT"
      log_error "── PR #$PR_NUMBER feedback handling failed ──"
      log_error_details "FEEDBACK PR#$PR_NUMBER" "$FEEDBACK_EXIT" "$ISSUE_OUTPUT"
      log "Error details written to: $ERROR_LOG"
    fi
    rm -f "$ISSUE_OUTPUT"

    sleep "$POLL_INTERVAL"
    continue
  fi

  # ══════════════════════════════════════════════════════════════════════════════
  # PRIORITY 3: Check for issues with "dev-ready" label
  # ══════════════════════════════════════════════════════════════════════════════
  # Fetch open issues with "dev-ready" label assigned to glawge-agent, excluding any already "in-progress"
  # Sorted by oldest first (FIFO queue)
  ISSUES_RAW=$(gh issue list \
    --repo "$REPO" \
    --search "label:dev-ready assignee:glawge-agent is:open sort:created-asc" \
    --json number,title,body,labels \
    --limit 10 2>&1) || true

  # Validate JSON
  if ! echo "$ISSUES_RAW" | jq empty 2>/dev/null; then
    log_error "Invalid JSON response from gh issue list"
    ISSUES="[]"
  else
    ISSUES="$ISSUES_RAW"
  fi

  # Filter out issues that have "in-progress" or "agent-failed" labels
  ISSUES=$(echo "$ISSUES" | jq '[.[] | select(.labels | map(.name) | (index("in-progress") or index("agent-failed")) | not)]' 2>/dev/null || echo "[]")

  COUNT=$(echo "$ISSUES" | jq 'length' 2>/dev/null || echo "0")

  if [ "$COUNT" -eq 0 ]; then

    # Fetch open issues with "needs-plan" label assigned to glawge-agent
    # Sorted by oldest first (FIFO queue)
    PLAN_ISSUES_RAW=$(gh issue list \
      --repo "$REPO" \
      --search "label:needs-plan assignee:glawge-agent is:open sort:created-asc" \
      --json number,title,labels \
      --limit 10 2>&1) || true

    # Validate JSON
    if ! echo "$PLAN_ISSUES_RAW" | jq empty 2>/dev/null; then
      log_error "Invalid JSON response for needs-plan issues"
      PLAN_ISSUES="[]"
    else
      PLAN_ISSUES="$PLAN_ISSUES_RAW"
    fi

    # Filter out issues that have "in-progress" or "agent-failed" labels
    PLAN_ISSUES=$(echo "$PLAN_ISSUES" | jq '[.[] | select(.labels | map(.name) | (index("in-progress") or index("agent-failed")) | not)]' 2>/dev/null || echo "[]")

    PLAN_COUNT=$(echo "$PLAN_ISSUES" | jq 'length' 2>/dev/null || echo "0")

    if [ "$PLAN_COUNT" -eq 0 ]; then
      # No issues - run a default task
      if /app/run-default-task.sh; then
        : # run-default-task.sh handles its own activity logging
      else
        activity "IDLE — all tasks on cooldown"
        log "All tasks on cooldown. Sleeping..."
      fi
    else
      # Process needs-plan issues
      for i in $(seq 0 $((PLAN_COUNT - 1))); do
        PLAN_NUMBER=$(echo "$PLAN_ISSUES" | jq -r ".[$i].number")
        PLAN_TITLE=$(echo "$PLAN_ISSUES" | jq -r ".[$i].title")

        activity "PLANNING #$PLAN_NUMBER"
        log "── Planning Issue #$PLAN_NUMBER: $PLAN_TITLE ──"

        # Capture output for error logging
        set +e
        /app/plan-issue.sh "$REPO" "$PLAN_NUMBER" 2>&1 | tee "$ISSUE_OUTPUT"
        PLAN_EXIT=${PIPESTATUS[0]}
        set -e

        if [ "$PLAN_EXIT" -eq 0 ]; then
          activity "✓ PLANNED #$PLAN_NUMBER"
          log "── Issue #$PLAN_NUMBER planning completed ──"
        else
          activity "✗ PLANNED #$PLAN_NUMBER — exit $PLAN_EXIT"
          log_error "── Issue #$PLAN_NUMBER planning failed ──"
          log_error_details "PLANNING #$PLAN_NUMBER" "$PLAN_EXIT" "$ISSUE_OUTPUT"
          log "Error details written to: $ERROR_LOG"
        fi
        rm -f "$ISSUE_OUTPUT"
      done
    fi
  else
    # Process dev-ready issues
    for i in $(seq 0 $((COUNT - 1))); do
      NUMBER=$(echo "$ISSUES" | jq -r ".[$i].number")
      TITLE=$(echo "$ISSUES" | jq -r ".[$i].title")

      activity "WORKING #$NUMBER"
      log "── Issue #$NUMBER: $TITLE ──"

      # Capture output for error logging
      set +e
      /app/process-issue.sh "$REPO" "$NUMBER" 2>&1 | tee "$ISSUE_OUTPUT"
      ISSUE_EXIT=${PIPESTATUS[0]}
      set -e

      if [ "$ISSUE_EXIT" -eq 0 ]; then
        activity "✓ COMPLETED #$NUMBER"
        log "── Issue #$NUMBER completed ──"
      else
        activity "✗ COMPLETED #$NUMBER — exit $ISSUE_EXIT"
        log_error "── Issue #$NUMBER failed ──"
        log_error_details "ISSUE #$NUMBER" "$ISSUE_EXIT" "$ISSUE_OUTPUT"
        log "Error details written to: $ERROR_LOG"
      fi
      rm -f "$ISSUE_OUTPUT"
    done
  fi

  sleep "$POLL_INTERVAL"
done
