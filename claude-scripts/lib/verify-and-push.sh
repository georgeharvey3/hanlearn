#!/bin/bash
# Shared helper: verify CI checks pass, then push branch and create PR
# Usage: source this script, then call verify_and_push "PR title" "PR body"
#
# Prerequisites:
#   - Must be run from the repo root directory
#   - GITHUB_TOKEN must be set
#   - Branch must already have commits

set -euo pipefail

REPO="${GITHUB_REPO:-georgeharvey3/hanlearn}"

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*"
}

log_error() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ERROR: $*"
}

# Run CI verification and fix any issues
# Returns 0 on success, 1 on failure
verify_ci_checks() {
  local work_dir
  work_dir=$(pwd)

  log "Verifying CI checks..."
  cd "$work_dir/web-client"

  # Install dependencies
  log "  Installing dependencies..."
  if ! npm install --cache "$work_dir/.npm-cache" 2>&1; then
    log_error "npm install failed"
    cd "$work_dir"
    return 1
  fi

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

  cd "$work_dir"

  # If all checks pass, we're done
  if [ $LINT_EXIT -eq 0 ] && [ $FORMAT_EXIT -eq 0 ] && [ $BUILD_EXIT -eq 0 ]; then
    log "All CI checks passed."
    return 0
  fi

  # Build error message for Claude
  log "CI checks failed - invoking Claude to fix..."

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

  FIX_PROMPT="The CI checks are failing. Fix all errors before the code can be pushed.
${ERRORS}

## Instructions:
1. Read the error messages and fix each issue
2. For lint errors: fix the code issues, or if available run 'cd web-client && npm run lint:fix'
3. For format errors: run 'cd web-client && npm run format' to auto-fix formatting
4. For build errors: fix the TypeScript/compilation issues
5. Verify all checks pass:
   cd web-client && npm run lint && npm run format:check && npm run build
6. Commit your fixes with: git commit -am \"fix: resolve lint/format/build errors\"

All checks must pass before you're done."

  if ! claude -p "$FIX_PROMPT" \
    --dangerously-skip-permissions \
    --allowed-tools "Bash,Read,Write,Edit,Grep,Glob" 2>&1; then
    log_error "Claude Code failed to fix CI errors"
    return 1
  fi

  # Verify all checks pass now
  cd "$work_dir/web-client"
  if ! npm run lint 2>&1; then
    log_error "Lint still failing after fix attempt"
    cd "$work_dir"
    return 1
  fi
  if ! npm run format:check 2>&1; then
    log_error "Format check still failing after fix attempt"
    cd "$work_dir"
    return 1
  fi
  if ! npm run build 2>&1; then
    log_error "Build still failing after fix attempt"
    cd "$work_dir"
    return 1
  fi

  cd "$work_dir"
  log "CI checks fixed successfully."
  return 0
}

# Main function: verify CI, push branch, create PR
# Usage: verify_and_push "PR title" "PR body"
verify_and_push() {
  local pr_title="$1"
  local pr_body="$2"

  # Verify CI checks pass
  if ! verify_ci_checks; then
    log_error "CI verification failed - not pushing"
    return 1
  fi

  # Push the branch
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)
  log "Pushing branch: $branch"

  if ! git push -u origin "$branch" 2>&1; then
    log "Push rejected — attempting pull --rebase and retry..."
    if git pull --rebase origin "$branch" 2>&1; then
      if ! git push -u origin "$branch" 2>&1; then
        log_error "Push failed after rebase"
        return 1
      fi
    else
      # Rebase failed (e.g. diverged histories) — force push as last resort
      log "Rebase failed — force pushing with lease..."
      if ! git push --force-with-lease -u origin "$branch" 2>&1; then
        log_error "Force push failed"
        return 1
      fi
    fi
  fi
  log "Branch pushed successfully."

  # Create PR (treat "already exists" as success)
  log "Creating pull request..."
  local pr_output
  set +e
  pr_output=$(gh pr create \
    --repo "$REPO" \
    --title "$pr_title" \
    --body "$pr_body" \
    --base main \
    --head "$branch" 2>&1)
  local pr_exit=$?
  set -e

  if [ "$pr_exit" -eq 0 ]; then
    log "PR created successfully."
    echo "$pr_output"
    return 0
  fi

  # Check if failure is because PR already exists
  if echo "$pr_output" | grep -q "already exists"; then
    log "PR already exists for branch $branch — treating as success."
    echo "$pr_output"
    return 0
  fi

  log_error "PR creation failed"
  echo "$pr_output"
  return 1
}
