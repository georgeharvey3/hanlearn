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
# Scripts cycle indefinitely in alphabetical order, 30 minutes apart.
# To add a script to the rotation:
#   cp claude-scripts/bug-hunt.sh claude-tasks/bug-hunt.sh
# To remove it from rotation, just delete it from claude-tasks/.
# Per-script progress logs (last 5 runs) are kept in claude-tasks/logs/*.progress.md

# Always resolve paths relative to this script's location
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_DIR="$REPO_DIR/claude-tasks"
DONE_DIR="$TASK_DIR/done"
LOG_DIR="$TASK_DIR/logs"

mkdir -p "$DONE_DIR" "$LOG_DIR"

echo "$(date): Claude task runner started."
echo "$(date): Repo: $REPO_DIR"
echo "$(date): Cycling scripts in: $TASK_DIR"
echo "$(date): 30 minutes between each run."
echo ""

INDEX=0

while true; do
    # Reload task list each iteration so additions/removals are picked up
    mapfile -t TASKS < <(find "$TASK_DIR" -maxdepth 1 \( -name "*.md" -o -name "*.sh" \) | sort)

    if [ ${#TASKS[@]} -eq 0 ]; then
        echo "$(date): No tasks in rotation. Sleeping 30 minutes..."
        sleep 1800
        INDEX=0
        continue
    fi

    # Wrap index if the list shrank
    if [ $INDEX -ge ${#TASKS[@]} ]; then
        INDEX=0
    fi

    TASK="${TASKS[$INDEX]}"
    TASK_NAME=$(basename "$TASK")
    echo "$(date): ─────────────────────────────────────"
    echo "$(date): Running task $((INDEX + 1))/${#TASKS[@]}: $TASK_NAME"
    echo "$(date): ─────────────────────────────────────"

    # Run from the repo root so relative paths in scripts/prompts work
    cd "$REPO_DIR"

    if [[ "$TASK" == *.sh ]]; then
        # Shell script: execute it directly (script calls claude itself)
        export TASK_PROGRESS_LOG="$LOG_DIR/$TASK_NAME.progress.md"
        bash "$TASK" 2>&1 | tee "$LOG_DIR/$TASK_NAME.log"
    else
        # Plain text .md: pass content as the prompt
        PROMPT=$(cat "$TASK")
        claude -p "$PROMPT" --allowedTools "Bash,Read,Write,Edit" \
            2>&1 | tee "$LOG_DIR/$TASK_NAME.log"
    fi

    EXIT_CODE=${PIPESTATUS[0]}

    if [ $EXIT_CODE -eq 0 ]; then
        echo "$(date): ✓ Completed: $TASK_NAME"
        echo "$(date): Log: $LOG_DIR/$TASK_NAME.log"
        INDEX=$((INDEX + 1))
        echo "$(date): Sleeping 30 minutes before next task..."
        sleep 1800
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
            echo "$(date): ✗ Failed: $TASK_NAME (kept in rotation)"
            echo "$(date): Check: $LOG_DIR/$TASK_NAME.log"
            INDEX=$((INDEX + 1))
            echo "$(date): Sleeping 30 minutes before next task..."
            sleep 1800
        fi
    fi

    echo ""
done
