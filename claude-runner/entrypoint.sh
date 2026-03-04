#!/bin/bash
set -euo pipefail

# Log function that ensures output is flushed immediately
log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*"
}

log_error() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ERROR: $*"
}

REPO="georgeharvey3/hanlearn"
POLL_INTERVAL=120  # seconds

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

while true; do
  log "Checking for dev-ready issues..."

  # Fetch open issues with "dev-ready" label assigned to glawge-agent, excluding any already "in-progress"
  log "  Fetching issues from GitHub..."
  ISSUES_RAW=$(gh issue list \
    --repo "$REPO" \
    --label "dev-ready" \
    --assignee "glawge-agent" \
    --state open \
    --json number,title,body,labels \
    --limit 10 2>&1) || true
  log "  Raw response: $ISSUES_RAW"

  # Validate JSON
  if ! echo "$ISSUES_RAW" | jq empty 2>/dev/null; then
    log_error "Invalid JSON response from gh issue list"
    ISSUES="[]"
  else
    ISSUES="$ISSUES_RAW"
  fi

  # Filter out issues that also have "in-progress" label
  ISSUES=$(echo "$ISSUES" | jq '[.[] | select(.labels | map(.name) | index("in-progress") | not)]' 2>/dev/null || echo "[]")
  log "  After filtering in-progress: $ISSUES"

  COUNT=$(echo "$ISSUES" | jq 'length' 2>/dev/null || echo "0")

  if [ "$COUNT" -eq 0 ]; then
    log "  No dev-ready issues found. Checking for needs-plan issues..."

    # Fetch open issues with "needs-plan" label assigned to glawge-agent
    PLAN_ISSUES_RAW=$(gh issue list \
      --repo "$REPO" \
      --label "needs-plan" \
      --assignee "glawge-agent" \
      --state open \
      --json number,title,labels \
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
      log "  No needs-plan issues found either."
    else
      log "  Found $PLAN_COUNT needs-plan issue(s). Processing..."

      # Process one issue at a time
      for i in $(seq 0 $((PLAN_COUNT - 1))); do
        PLAN_NUMBER=$(echo "$PLAN_ISSUES" | jq -r ".[$i].number")
        PLAN_TITLE=$(echo "$PLAN_ISSUES" | jq -r ".[$i].title")

        echo ""
        log "── Planning Issue #$PLAN_NUMBER: $PLAN_TITLE ──"

        if /app/plan-issue.sh "$REPO" "$PLAN_NUMBER"; then
          log "── Issue #$PLAN_NUMBER planning completed successfully ──"
        else
          log_error "── Issue #$PLAN_NUMBER planning failed (exit code: $?) ──"
        fi
        echo ""
      done
    fi
  else
    log "  Found $COUNT dev-ready issue(s). Processing..."

    # Process one issue at a time
    for i in $(seq 0 $((COUNT - 1))); do
      NUMBER=$(echo "$ISSUES" | jq -r ".[$i].number")
      TITLE=$(echo "$ISSUES" | jq -r ".[$i].title")

      echo ""
      log "── Issue #$NUMBER: $TITLE ──"

      if /app/process-issue.sh "$REPO" "$NUMBER"; then
        log "── Issue #$NUMBER completed successfully ──"
      else
        log_error "── Issue #$NUMBER failed (exit code: $?) ──"
      fi
      echo ""
    done
  fi

  log "Sleeping ${POLL_INTERVAL}s..."
  sleep "$POLL_INTERVAL"
done
