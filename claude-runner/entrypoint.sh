#!/bin/bash
set -euo pipefail

REPO="georgeharvey3/hanlearn"
POLL_INTERVAL=120  # seconds

echo "=== HanLearn Claude Runner ==="
echo "Repo: $REPO"
echo "Polling every ${POLL_INTERVAL}s for issues labeled 'dev-ready'"
echo ""

# Verify credentials
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "ERROR: GITHUB_TOKEN is not set" >&2
  exit 1
fi
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "ERROR: CLAUDE_CODE_OAUTH_TOKEN is not set" >&2
  exit 1
fi

# Authenticate gh CLI
echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null
echo "GitHub CLI authenticated."
echo ""

while true; do
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Checking for dev-ready issues..."

  # Fetch open issues with "dev-ready" label, excluding any already "in-progress"
  ISSUES=$(gh issue list \
    --repo "$REPO" \
    --label "dev-ready" \
    --state open \
    --json number,title,body,labels \
    --limit 10 2>/dev/null || echo "[]")

  # Filter out issues that also have "in-progress" label
  ISSUES=$(echo "$ISSUES" | jq '[.[] | select(.labels | map(.name) | index("in-progress") | not)]')

  COUNT=$(echo "$ISSUES" | jq 'length')

  if [ "$COUNT" -eq 0 ]; then
    echo "  No dev-ready issues found."
  else
    echo "  Found $COUNT dev-ready issue(s). Processing..."

    # Process one issue at a time
    for i in $(seq 0 $((COUNT - 1))); do
      NUMBER=$(echo "$ISSUES" | jq -r ".[$i].number")
      TITLE=$(echo "$ISSUES" | jq -r ".[$i].title")

      echo ""
      echo "  ── Issue #$NUMBER: $TITLE ──"

      /app/process-issue.sh "$REPO" "$NUMBER" || true

      echo "  ── Done with #$NUMBER ──"
      echo ""
    done
  fi

  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Sleeping ${POLL_INTERVAL}s..."
  sleep "$POLL_INTERVAL"
done
