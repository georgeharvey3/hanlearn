#!/bin/bash
set -euo pipefail

# Default task orchestrator — runs when no GitHub issues are available
# Selects the highest-priority task whose cooldown has expired

REPO_ROOT="/app"
REGISTRY="$REPO_ROOT/claude-tasks/task-registry.json"
STATE_FILE="$REPO_ROOT/claude-tasks/orchestrator-state.json"
LOG_DIR="$REPO_ROOT/claude-tasks/logs"
ACTIVITY_LOG="$LOG_DIR/activity.log"
ERROR_LOG="$LOG_DIR/error.log"
TASK_OUTPUT="/tmp/task-output.log"

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')]     $*"
}

log_error() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')]     ERROR: $*"
}

# Log to activity file
activity() {
  local timestamp
  timestamp=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
  echo "[$timestamp] $*" >> "$ACTIVITY_LOG"
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
    echo "[$timestamp] TASK: $task_id — exit code $exit_code"
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

# Ensure directories and files exist
mkdir -p "$LOG_DIR"
if [ ! -f "$STATE_FILE" ]; then
  echo '{"last_runs": {}}' > "$STATE_FILE"
fi

NOW=$(date +%s)

# Select the best eligible task
select_task() {
  local best_task=""
  local best_priority=-1

  # Read all task IDs
  local task_ids
  task_ids=$(jq -r '.tasks[].id' "$REGISTRY")

  for task_id in $task_ids; do
    # Get task properties
    local cooldown_hours priority
    cooldown_hours=$(jq -r ".tasks[] | select(.id == \"$task_id\") | .cooldown_hours" "$REGISTRY")
    priority=$(jq -r ".tasks[] | select(.id == \"$task_id\") | .priority" "$REGISTRY")

    # Get last run time (0 if never run)
    local last_run
    last_run=$(jq -r ".last_runs[\"$task_id\"] // 0" "$STATE_FILE")

    local cooldown_seconds=$((cooldown_hours * 3600))
    local time_since_last=$((NOW - last_run))

    # Check if cooldown has expired
    if [ "$time_since_last" -ge "$cooldown_seconds" ]; then
      # Add bonus priority for tasks that are overdue
      # (10% bonus per extra cooldown period elapsed, capped at 50%)
      local extra_periods=0
      if [ "$cooldown_seconds" -gt 0 ]; then
        extra_periods=$(( (time_since_last / cooldown_seconds) - 1 ))
        if [ "$extra_periods" -lt 0 ]; then extra_periods=0; fi
        if [ "$extra_periods" -gt 5 ]; then extra_periods=5; fi
      fi
      local bonus=$((priority * extra_periods / 10))
      local effective_priority=$((priority + bonus))

      if [ "$effective_priority" -gt "$best_priority" ]; then
        best_priority=$effective_priority
        best_task=$task_id
      fi
    fi
  done

  echo "$best_task"
}

# Select task
SELECTED=$(select_task)

if [ -z "$SELECTED" ]; then
  exit 1  # Signal to caller that nothing was run
fi

# Get script path and description
SCRIPT=$(jq -r ".tasks[] | select(.id == \"$SELECTED\") | .script" "$REGISTRY")
DESCRIPTION=$(jq -r ".tasks[] | select(.id == \"$SELECTED\") | .description" "$REGISTRY")
COOLDOWN=$(jq -r ".tasks[] | select(.id == \"$SELECTED\") | .cooldown_hours" "$REGISTRY")

log "Selected task: $SELECTED"
log "  Description: $DESCRIPTION"
log "  Script: $SCRIPT"
log "  Cooldown: ${COOLDOWN}h"

# Check if script exists
SCRIPT_PATH="$REPO_ROOT/$SCRIPT"
if [ ! -f "$SCRIPT_PATH" ]; then
  log_error "Script not found: $SCRIPT_PATH"
  exit 1
fi

# Set up progress log path for the task
export TASK_PROGRESS_LOG="$LOG_DIR/${SELECTED}.progress.md"
log "  Progress log: $TASK_PROGRESS_LOG"

# Clone the repo to a work directory (tasks need a fresh copy)
WORK_DIR="/tmp/work-default-task"
rm -rf "$WORK_DIR"

log "Cloning repo for task execution..."
REPO_NAME="${GITHUB_REPO:-georgeharvey3/hanlearn}"
if ! git clone --depth 1 "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_NAME}.git" "$WORK_DIR" 2>&1; then
  log_error "Failed to clone repo"
  exit 1
fi

# Copy the task script to work dir (it references relative paths)
cp "$SCRIPT_PATH" "$WORK_DIR/"
SCRIPT_NAME=$(basename "$SCRIPT")

activity "TASK $SELECTED"
log "Running task: $SELECTED"
log "─────────────────────────────────────"

# Execute the task from the work directory, capturing output
cd "$WORK_DIR"
export TASK_PROGRESS_LOG  # Ensure it's available to the script

# Run task and capture output (tee to both stdout and file)
set +e  # Don't exit on error - we need to capture the exit code
bash "./$SCRIPT_NAME" 2>&1 | tee "$TASK_OUTPUT"
EXIT_CODE=${PIPESTATUS[0]}
set -e

if [ "$EXIT_CODE" -eq 0 ]; then
  log "─────────────────────────────────────"
  log "Task completed successfully."

  # Update last run timestamp
  jq ".last_runs[\"$SELECTED\"] = $NOW" "$STATE_FILE" > "${STATE_FILE}.tmp"
  mv "${STATE_FILE}.tmp" "$STATE_FILE"

  activity "✓ DONE $SELECTED — cooldown ${COOLDOWN}h"
  log "Cooldown started for $SELECTED (${COOLDOWN}h)"

  # Copy progress log back to persistent location if it was created/updated
  if [ -f "$TASK_PROGRESS_LOG" ]; then
    log "Progress log updated."
  fi
else
  log "─────────────────────────────────────"
  log_error "Task failed with exit code $EXIT_CODE"
  activity "✗ DONE $SELECTED — exit $EXIT_CODE, will retry"
  log_error_details "$SELECTED" "$EXIT_CODE" "$TASK_OUTPUT"
  log "Error details written to: $ERROR_LOG"
  log "Cooldown NOT updated — task will retry next cycle."
fi

# Clean up task output file
rm -f "$TASK_OUTPUT"

# Backup any unpushed work before cleanup
BACKUP_DIR="$REPO_ROOT/claude-tasks/backups"
mkdir -p "$BACKUP_DIR"

if [ -d "$WORK_DIR/.git" ]; then
  cd "$WORK_DIR"

  # Check for unpushed commits (commits ahead of origin/main)
  UNPUSHED=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l || echo 0)

  # Check for uncommitted changes
  UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l || echo 0)

  if [ "$UNPUSHED" -gt 0 ] || [ "$UNCOMMITTED" -gt 0 ]; then
    BACKUP_NAME="${SELECTED}-$(date +%Y%m%d-%H%M%S)"
    BUNDLE_PATH="$BACKUP_DIR/${BACKUP_NAME}.bundle"

    log "Saving backup: $UNPUSHED unpushed commit(s), $UNCOMMITTED uncommitted change(s)"

    # Commit any uncommitted changes so they're included in the bundle
    if [ "$UNCOMMITTED" -gt 0 ]; then
      git add -A
      git commit -m "WIP: uncommitted changes at task failure" --no-verify 2>/dev/null || true
    fi

    # Create a git bundle containing all commits not in origin/main
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")
    if git bundle create "$BUNDLE_PATH" origin/main.."$CURRENT_BRANCH" 2>/dev/null; then
      log "Backup saved to: $BUNDLE_PATH"
      log "To restore: git clone $BUNDLE_PATH restored-work"
    else
      # Fallback: bundle the entire branch if origin/main comparison fails
      if git bundle create "$BUNDLE_PATH" "$CURRENT_BRANCH" 2>/dev/null; then
        log "Full branch backup saved to: $BUNDLE_PATH"
      else
        log_error "Failed to create git bundle backup"
      fi
    fi
  else
    log "No unpushed work to backup."
  fi

  cd /app
fi

# Cleanup
rm -rf "$WORK_DIR"
log "Cleanup complete."
