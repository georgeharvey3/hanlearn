#!/bin/bash
# Quick status check for the Claude Runner

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TASKS_DIR="$SCRIPT_DIR/../claude-tasks"
ACTIVITY_LOG="$TASKS_DIR/logs/activity.log"
ERROR_LOG="$TASKS_DIR/logs/error.log"
STATE_FILE="$TASKS_DIR/orchestrator-state.json"
REGISTRY="$TASKS_DIR/task-registry.json"

echo "=== Claude Runner Status ==="
echo ""

# Check if container is running
if docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps --status running 2>/dev/null | grep -q claude-runner; then
  echo "Container: RUNNING"
else
  echo "Container: STOPPED"
fi
echo ""

# Recent activity
echo "--- Recent Activity ---"
if [ -f "$ACTIVITY_LOG" ]; then
  tail -10 "$ACTIVITY_LOG"
else
  echo "(no activity yet)"
fi
echo ""

# Task cooldowns
echo "--- Task Cooldowns ---"
NOW=$(date +%s)
if [ -f "$REGISTRY" ] && [ -f "$STATE_FILE" ]; then
  jq -r '.tasks[] | "\(.id)|\(.cooldown_hours)"' "$REGISTRY" | while IFS='|' read -r task_id cooldown_hours; do
    last_run=$(jq -r ".last_runs[\"$task_id\"] // 0" "$STATE_FILE")
    cooldown_seconds=$((cooldown_hours * 3600))

    if [ "$last_run" -eq 0 ]; then
      echo "  $task_id: never run (ready)"
    else
      time_since=$((NOW - last_run))
      remaining=$((cooldown_seconds - time_since))

      if [ "$remaining" -le 0 ]; then
        echo "  $task_id: ready"
      else
        hours=$((remaining / 3600))
        mins=$(((remaining % 3600) / 60))
        echo "  $task_id: ${hours}h ${mins}m remaining"
      fi
    fi
  done
else
  echo "(no task registry found)"
fi
echo ""

# Recent errors
echo "--- Recent Errors ---"
if [ -f "$ERROR_LOG" ]; then
  # Count error entries (each starts with ═══)
  ERROR_COUNT=$(grep -c "^═══" "$ERROR_LOG" 2>/dev/null || echo "0")
  if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "$ERROR_COUNT error(s) logged. Last error:"
    # Show the last error block (from last ═══ to end or next ═══)
    tac "$ERROR_LOG" | awk '/^═══/{if(found) exit; found=1} found' | tac | head -20
    echo ""
    echo "Full log: $ERROR_LOG"
  else
    echo "(no errors)"
  fi
else
  echo "(no error log yet)"
fi
echo ""

# Open PRs from bot
echo "--- Open PRs ---"
gh pr list --author "georgeharvey3" --search "head:claude/" --state open --limit 5 2>/dev/null || echo "(could not fetch PRs)"
