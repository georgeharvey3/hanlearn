#!/bin/bash
# Creates GitHub issues for the 5 most urgent technical debt items
# identified in the HanLearn codebase audit (2026-02-28).
#
# Prerequisites: gh CLI authenticated (`gh auth login`)
# Usage: bash scripts/create-tech-debt-issues.sh

set -euo pipefail

REPO="georgeharvey3/hanlearn"

echo "Creating 5 technical debt issues for $REPO..."
echo

# --- Issue 1: Error Boundaries ---
gh issue create --repo "$REPO" \
  --title "Add React error boundaries to component tree" \
  --label "bug" --label "enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Problem

The application currently has no React error boundaries anywhere in the component tree. If a component throws during rendering, the entire app crashes with an unrecoverable white screen.

This is acknowledged in CLAUDE.md as a known issue.

## Impact

- **User experience**: Any rendering error crashes the entire app with no recovery path
- **Debugging**: No error information is shown to users or captured
- **Reliability**: Particularly risky for components that depend on external data (Firebase, dictionary loading, speech APIs)

## Proposed Solution

1. Create a generic `ErrorBoundary` component with a user-friendly fallback UI
2. Wrap top-level route components in error boundaries so a crash in one route doesn't take down the whole app
3. Add granular error boundaries around high-risk areas:
   - Test/quiz components (complex state machine in `useTestEngine`)
   - Dictionary search (lazy-loaded `dictionary.json`)
   - Speech recognition/synthesis (browser-dependent APIs with no consistent fallback)
   - Chengyu challenge (Cloud Function calls)
4. Log caught errors for debugging

## Files Likely Affected

- New: `web-client/src/components/ErrorBoundary/ErrorBoundary.tsx`
- `web-client/src/App.tsx` — wrap route components
- `web-client/src/components/Test/Test.tsx`
- `web-client/src/containers/AddWords/AddWords.tsx`

## Priority

High — this is a reliability gap with no workaround.
ISSUE_EOF
)"
echo "✓ Issue 1 created: Error boundaries"

# --- Issue 2: Accessibility ---
gh issue create --repo "$REPO" \
  --title "Improve accessibility: semantic HTML and keyboard navigation" \
  --label "accessibility" --label "enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Problem

Several components use non-semantic HTML and manual event handling where native elements would provide better accessibility out of the box.

### Specific Issues

1. **Toolbar logo** (`web-client/src/components/Navigation/Toolbar/Toolbar.tsx:57`): Uses a `<Typography>` with `role="link"`, manual `tabIndex`, and an `onKeyDown` handler instead of a native `<a>` or `<button>` element. Screen readers and keyboard users get a degraded experience.

2. **Missing landmark elements**: The `Layout` component uses MUI's `component="main"` but there are no `<header>` or `<nav>` wrapper elements for the toolbar/navigation areas.

3. **Sparse ARIA attributes**: While some components have `aria-label` (Input, AnswerInput, Modal, DrawerToggle), many interactive elements across the app lack accessible names.

4. **Handwriting canvas** (`web-client/src/components/Test/AnswerInput.tsx:83`): The drawing area is an empty div with no visible affordance or accessible label. There's an existing TODO comment acknowledging this.

## Impact

- Screen reader users cannot effectively navigate the app
- Keyboard-only users hit dead ends in navigation
- Does not meet WCAG 2.1 Level A in several areas

## Proposed Solution

1. Replace `role="link"` on Toolbar logo with a proper `<a>` or `<Link>` element
2. Add `<header>` and `<nav>` landmarks to the Layout/Toolbar structure
3. Audit and add `aria-label` / `aria-describedby` to interactive components that lack them
4. Add placeholder text and border to the handwriting canvas div

## Priority

High — accessibility is a baseline requirement, not a nice-to-have.
ISSUE_EOF
)"
echo "✓ Issue 2 created: Accessibility"

# --- Issue 3: getDailyChengyu Performance ---
gh issue create --repo "$REPO" \
  --title "Optimize getDailyChengyu: full collection scan on every call" \
  --label "performance" --label "backend" \
  --body "$(cat <<'ISSUE_EOF'
## Problem

The `getDailyChengyu` Cloud Function (`functions/src/index.ts:63-140`) fetches the **entire** `chengyus` collection into memory on every invocation:

```typescript
const snapshot = await db.collection('chengyus').get(); // line 74
```

It then shuffles the full list in memory and picks one based on the day. The `lookupChengyuChar` function (lines 145-183) compounds this by running an **unindexed** `where('simp', '==', char)` query for every character in the selected chengyu.

### Additional Issues

- Line 96 uses `Math.random() - 0.5` as a sort comparator — this produces a biased shuffle, not a uniform one
- The result is deterministic per day but there is no caching, so every user triggers the full scan

## Impact

- **Cost**: Every call reads the entire chengyus collection (Firestore charges per read)
- **Latency**: Full collection scan + multiple per-character queries adds up
- **Correctness**: Biased shuffle means some chengyus appear more often than others

## Proposed Solution

1. **Cache the daily result**: Store the day's chengyu in a `dailyChengyu` document (or use Firestore TTL). Subsequent calls read one document instead of the full collection.
2. **Add a Firestore index** on the `words` collection for the `simp` field used in `lookupChengyuChar`
3. **Batch character lookups**: Instead of one query per character, use a single `where('simp', 'in', [chars])` query
4. **Fix the shuffle**: Use Fisher-Yates algorithm instead of `sort(() => Math.random() - 0.5)`

## Files Affected

- `functions/src/index.ts` — getDailyChengyu, lookupChengyuChar
- `firestore.indexes.json` — add index for `words.simp`

## Priority

Medium-High — affects cost and latency for every user, every day.
ISSUE_EOF
)"
echo "✓ Issue 3 created: getDailyChengyu performance"

# --- Issue 4: Memoization ---
gh issue create --repo "$REPO" \
  --title "Add React.memo / useMemo / useCallback to frequently-rendering components" \
  --label "performance" --label "enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Problem

A search across the entire codebase finds **zero** instances of `React.memo`, `useMemo`, or `useCallback` (beyond one good usage in `useTestEngine.ts`). With 70+ components, many of which re-render on Redux state changes, this means unnecessary re-renders throughout the app.

### Most Impactful Areas

- **Dashboard** (`web-client/src/containers/Dashboard/Dashboard.tsx`): Renders multiple widget cards that recompute stats on every render
- **Test components** (`web-client/src/components/Test/`): The quiz UI re-renders frequently during active test sessions — the most performance-sensitive user flow
- **AddWords** (`web-client/src/containers/AddWords/AddWords.tsx`): Large component (521 lines) with dictionary search and word table
- **Redux `connect()`** pattern: While `connect()` provides some shallow equality checking, the mapDispatchToProps functions create new function references on every render

## Impact

- Sluggish interactions on lower-end mobile devices (the primary use case per CLAUDE.md)
- Unnecessary re-renders of child components when parent state changes
- Dictionary search and word table operations may feel laggy

## Proposed Solution

1. Profile the app to identify the worst re-render hotspots (React DevTools Profiler)
2. Add `React.memo` to pure presentational components (widget cards, table rows, navigation items)
3. Add `useMemo` for expensive computations (stats calculations in Dashboard, dictionary search results)
4. Add `useCallback` for event handlers passed as props (especially in Test and AddWords)
5. Consider this alongside the eventual Redux hooks migration — `useSelector` with proper selectors would also help

## Priority

Medium — the app works but will feel slow on mobile, which is the primary target platform.
ISSUE_EOF
)"
echo "✓ Issue 4 created: Memoization"

# --- Issue 5: Rate Limiting ---
gh issue create --repo "$REPO" \
  --title "Add rate limiting to Cloud Functions (translateWithDeepL)" \
  --label "security" --label "backend" \
  --body "$(cat <<'ISSUE_EOF'
## Problem

The `translateWithDeepL` Cloud Function (`functions/src/index.ts:29-58`) has no rate limiting or request size limits. While it does verify authentication (line 31), any authenticated user can call it as frequently as they want.

### Specific Gaps

- No per-user rate limiting on translation requests
- No input size validation (text field length is unchecked beyond non-empty check)
- No daily/monthly quota per user
- Translation API costs are borne by the project — a single user could generate significant costs

## Impact

- **Cost risk**: An authenticated user (or compromised account) could rack up translation API charges
- **Abuse**: Automated scripts could use the endpoint as a free translation proxy
- **Availability**: High call volume from one user could affect others

## Proposed Solution

1. Add per-user rate limiting (e.g., 50 translations/hour) using Firestore counters or Firebase Rate Limiter extension
2. Add input size validation (e.g., max 500 characters per request)
3. Consider adding a daily translation quota per user
4. Log translation usage for monitoring

## Files Affected

- `functions/src/index.ts` — translateWithDeepL function

## Priority

Medium — low probability but high potential impact. Simple to implement.
ISSUE_EOF
)"
echo "✓ Issue 5 created: Rate limiting"

echo
echo "All 5 issues created successfully!"
