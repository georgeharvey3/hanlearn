#!/bin/bash
# Autonomous Claude Code task runner
# Run in a tmux session: tmux new -s claude-runner
# Then: chmod +x claude-runner.sh && ./claude-runner.sh
# Detach with Ctrl+B, D
#
# Task file formats supported in claude-tasks/:
#   *.md  — plain text prompt, passed directly to: claude -p "<content>"
#   *.sh  — shell script, executed directly (must call claude itself)
#
# To queue a task:
#   cp claude-scripts/bug-hunt.sh claude-tasks/01-bug-hunt.sh
#   echo "Fix the login error message" > claude-tasks/02-custom.md

# Always resolve paths relative to this script's location
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_DIR="$REPO_DIR/claude-tasks"
DONE_DIR="$TASK_DIR/done"
LOG_DIR="$TASK_DIR/logs"

mkdir -p "$DONE_DIR" "$LOG_DIR"

echo "$(date): Claude task runner started."
echo "$(date): Repo: $REPO_DIR"
echo "$(date): Watching: $TASK_DIR"
echo "$(date): Drop .md or .sh files into claude-tasks/ to queue work."
echo ""

while true; do
    # Pick the first task file (alphabetical), either .md or .sh
    TASK=$(find "$TASK_DIR" -maxdepth 1 \( -name "*.md" -o -name "*.sh" \) | sort | head -1)

    if [ -z "$TASK" ]; then
        echo "$(date): No tasks found. Sleeping 30 minutes..."
        sleep 1800
        continue
    fi

    TASK_NAME=$(basename "$TASK")
    echo "$(date): ─────────────────────────────────────"
    echo "$(date): Starting task: $TASK_NAME"
    echo "$(date): ─────────────────────────────────────"

    # Run from the repo root so relative paths in scripts/prompts work
    cd "$REPO_DIR"

    if [[ "$TASK" == *.sh ]]; then
        # Shell script: execute it directly (script calls claude itself)
        bash "$TASK" 2>&1 | tee "$LOG_DIR/$TASK_NAME.log"
    else
        # Plain text .md: pass content as the prompt
        PROMPT=$(cat "$TASK")
        claude -p "$PROMPT" --allowedTools "Bash,Read,Write,Edit" \
            2>&1 | tee "$LOG_DIR/$TASK_NAME.log"
    fi

    EXIT_CODE=${PIPESTATUS[0]}

    if [ $EXIT_CODE -eq 0 ]; then
        mv "$TASK" "$DONE_DIR/"
        echo "$(date): ✓ Completed: $TASK_NAME"
        echo "$(date): Log: $LOG_DIR/$TASK_NAME.log"
    else
        if grep -qi "rate limit\|quota\|too many requests\|overloaded\|529" \
            "$LOG_DIR/$TASK_NAME.log"; then
            echo "$(date): Rate limited. Retrying in 15 minutes..."
            while true; do
                sleep 900
                if claude -p "Say OK" 2>&1 | grep -qi "ok"; then
                    echo "$(date): Quota available. Resuming: $TASK_NAME"
                    break
                fi
                echo "$(date): Still rate limited. Waiting another 15 minutes..."
            done
        else
            echo "$(date): ✗ Failed (non-quota). Skipping: $TASK_NAME"
            mv "$TASK" "$DONE_DIR/FAILED-$TASK_NAME"
            echo "$(date): Check: $LOG_DIR/$TASK_NAME.log"
        fi
    fi

    echo ""
done
