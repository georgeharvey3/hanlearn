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
  fi
}

echo "=== HanLearn Claude Runner ==="
echo "Repo: $REPO"
echo "Polling every ${POLL_INTERVAL}s for issues labeled 'dev-ready' or 'needs-plan'"
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
  # Fetch open issues with "dev-ready" label assigned to glawge-agent, excluding any already "in-progress"
  # Sorted by oldest first (FIFO queue)
  ISSUES_RAW=$(gh issue list \
    --repo "$REPO" \
    --label "dev-ready" \
    --assignee "glawge-agent" \
    --state open \
    --json number,title,body,labels \
    --order asc \
    --limit 10 2>&1) || true

  # Validate JSON
  if ! echo "$ISSUES_RAW" | jq empty 2>/dev/null; then
    log_error "Invalid JSON response from gh issue list"
    ISSUES="[]"
  else
    ISSUES="$ISSUES_RAW"
  fi

  # Filter out issues that also have "in-progress" label
  ISSUES=$(echo "$ISSUES" | jq '[.[] | select(.labels | map(.name) | index("in-progress") | not)]' 2>/dev/null || echo "[]")

  COUNT=$(echo "$ISSUES" | jq 'length' 2>/dev/null || echo "0")

  if [ "$COUNT" -eq 0 ]; then

    # Fetch open issues with "needs-plan" label assigned to glawge-agent
    # Sorted by oldest first (FIFO queue)
    PLAN_ISSUES_RAW=$(gh issue list \
      --repo "$REPO" \
      --label "needs-plan" \
      --assignee "glawge-agent" \
      --state open \
      --json number,title,labels \
      --order asc \
      --limit 10 2>&1) || true

    # Validate JSON
    if ! echo "$PLAN_ISSUES_RAW" | jq empty 2>/dev/null; then
      log_error "Invalid JSON response for needs-plan issues"
      PLAN_ISSUES="[]"
    else
      PLAN_ISSUES="$PLAN_ISSUES_RAW"
    fi

    # Filter out issues that also have "in-progress" label
    PLAN_ISSUES=$(echo "$PLAN_ISSUES" | jq '[.[] | select(.labels | map(.name) | index("in-progress") | not)]' 2>/dev/null || echo "[]")

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
