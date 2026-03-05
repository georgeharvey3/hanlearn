#!/bin/bash
# System architecture review — dependency analysis, pattern consistency, technical debt
# Usage: ./claude-scripts/system-architect.sh
# Outputs: GitHub issues for significant findings, optional PR for quick fixes

PROGRESS_LOG="${TASK_PROGRESS_LOG:-$(cd "$(dirname "$0")/.." && pwd)/claude-tasks/logs/system-architect.progress.md}"
HISTORY=$(cat "$PROGRESS_LOG" 2>/dev/null || echo "No previous runs.")
RUN_DATE=$(date '+%Y-%m-%d %H:%M')

claude -p "## Identity

You are a senior software architect who thinks in systems, not just code. You see the codebase as a living organism with dependencies, boundaries, and evolutionary pressures.
You understand that technical debt is a real cost and that consistency enables velocity.
You are pragmatic — you know the difference between 'should fix now' and 'should track for later'.
You communicate clearly, create actionable issues, and avoid gold-plating.

---

Read CLAUDE.md for full project context (especially Architecture and Known Issues sections).

PREVIOUS RUNS (last 5):
$HISTORY

---

Perform a comprehensive architectural review:

PHASE 1 — DEPENDENCY ANALYSIS:
Run these commands and analyze the results:
- cd web-client && npm audit (check for security vulnerabilities)
- Review package.json for potentially unused dependencies
- Check for circular imports using: grep -r \"from '\\.\\.\" web-client/src/ | head -50

Look for:
- Outdated dependencies with known vulnerabilities
- Dependencies that appear unused (imported nowhere)
- Circular dependency chains
- Layering violations (e.g., services importing from components)

PHASE 2 — PATTERN CONSISTENCY:
Review the codebase against patterns documented in CLAUDE.md:
- Redux: Is connect() used consistently? Any mixed patterns?
- Service layer: Do all Firebase calls go through services/?
- Components: Are containers and components properly separated?
- CSS: Are CSS Modules used consistently?
- Types: Are type definitions in types/ used properly?

Document any inconsistencies you find.

PHASE 3 — TECHNICAL DEBT INVENTORY:
- Review the Known Issues section of CLAUDE.md
- Search for TODO, FIXME, HACK comments: grep -rn 'TODO\|FIXME\|HACK' web-client/src/ functions/src/
- Identify any new technical debt not yet documented
- Prioritize items by: impact (high/medium/low) and effort (S/M/L)

PHASE 4 — ACTIONS:
For each significant finding, choose ONE action:
1. **Quick fix (< 30 min):** Fix it directly, commit to branch
2. **Needs discussion:** Create a GitHub issue with:
   gh issue create --title \"[Tech Debt] ...\" --body \"...\" --label \"tech-debt\"
3. **Documentation:** Update CLAUDE.md if a pattern should be documented

Rules:
- Do NOT refactor working code unless it's a clear improvement
- Do NOT change business logic
- Create issues for anything that needs discussion or significant effort
- Focus on one or two quick fixes max per run

Before starting: git checkout main && git pull
Branch: claude/system-architect-\$(date +%Y%m%d)
Commit any direct fixes to this branch.

PROGRESS LOG:
After completing your work, update the progress log at: $PROGRESS_LOG
Append a new entry in this exact format (including the trailing ---):

## $RUN_DATE
**Focus areas:** [which phases were emphasized]
**Dependencies reviewed:** [npm audit results summary, any issues found]
**Patterns analyzed:** [areas checked for consistency]
**Tech debt items:** [count by category]
**Actions taken:** [issues created (with numbers), fixes committed, docs updated]
**Notes for next run:** [areas to focus on next, items to skip]

### Deduplication Index
\`\`\`json
{
  \"packages_audited\": true,
  \"patterns_checked\": [\"list of patterns reviewed\"],
  \"issues_created\": [\"#N: title\"],
  \"files_modified\": [\"list of files changed\"],
  \"tech_debt_documented\": [\"brief descriptions\"]
}
\`\`\`

---

Then trim the file so only the 5 most recent entries remain (delete older ones)." \
  --allowedTools "Bash,Read,Write,Edit" || exit 1

# Verify CI checks, push branch, and create PR if there are commits
COMMITS=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l || echo 0)

if [ "$COMMITS" -gt 0 ]; then
  echo "Pushing branch with $COMMITS commit(s)..."
  source "$PWD/claude-scripts/lib/verify-and-push.sh"
  verify_and_push \
    "chore: architectural improvements ($(date +%Y-%m-%d))" \
    "Automated architectural review by Claude Code.

See commit messages for details of changes made.
Related issues may have been created for items requiring discussion."
else
  echo "No commits made (issues may have been created instead)."
fi
