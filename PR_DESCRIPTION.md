## Summary

Fixes #194 — When the mobile keyboard opens during a test/study session, the question card is no longer pushed off-screen.

- Created a `useKeyboardVisible` hook that uses the `visualViewport` API to detect when a mobile keyboard is open
- When the keyboard is detected, padding, gaps, and `minHeight` values in the test layouts shrink to keep the question visible above the input
- The result text in the main test view is hidden when the keyboard is open to reclaim space
- The input area auto-scrolls into view when the keyboard appears
- The main layout container now allows vertical scrolling as a fallback
- Added `interactive-widget=resizes-content` to the viewport meta tag for better Android Chrome behavior

## Key implementation details

- **`useKeyboardVisible` hook** (`web-client/src/hooks/useKeyboardVisible.ts`): Compares `visualViewport.height` to `window.innerHeight` with a 150px threshold to distinguish keyboard opening from URL bar changes. Falls back to `false` on desktop or unsupported browsers.
- **Smooth transitions**: All layout changes use `transition: 0.15s ease` to avoid jarring visual jumps.
- **No desktop impact**: The hook returns `false` on desktop, so all conditional styles default to their original values.
- **Hook ordering**: Hooks are placed before any early returns to comply with React's rules of hooks.

## Files modified

| File | Change |
|------|--------|
| `web-client/src/hooks/useKeyboardVisible.ts` | New hook for keyboard detection via `visualViewport` |
| `web-client/src/hooks/useKeyboardVisible.test.ts` | Unit tests for the hook (6 tests) |
| `web-client/src/components/Test/Test.tsx` | Shrink padding, card height, hide result text when keyboard open |
| `web-client/src/components/Test/SentenceWrite/SentenceWrite.tsx` | Reduce padding and gaps when keyboard open |
| `web-client/src/components/Test/SentenceRead/SentenceRead.tsx` | Reduce padding, gaps, and card height when keyboard open |
| `web-client/src/components/Layout/Layout.tsx` | Enable vertical scrolling on main container |
| `web-client/index.html` | Add `interactive-widget=resizes-content` viewport hint |

## Decisions and trade-offs

- **150px threshold** for keyboard detection is generous enough to avoid false positives from mobile URL bar hiding (~50-80px) while catching all common keyboard sizes (~250px+).
- **Hiding result text** during keyboard-open state was preferred over just shrinking it, since it's the least critical element and frees the most space.
- **`scrollIntoView`** is called as a safety net — even if the layout compaction isn't enough on very small screens, the browser will scroll to keep the input visible.
