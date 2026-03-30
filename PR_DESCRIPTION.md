## Summary

Fixes #276 — the test screen no longer flashes "No words due in General" before loading.

The root cause was a timing gap between when words finish loading from Firestore (`wordsLoading` becomes `false`) and when `setSelectedWords()` runs in a `useEffect`. During that gap, the component would render with `selectedWords=[]` and `wordsLoading=false`, which hit the "No words due" branch.

## Key Implementation Details

- Added a `wordsInitialized` flag to `TestWordsState` that starts `false` and is set to `true` only after word selection has actually run
- The render logic now shows a loading spinner when `!wordsInitialized` (in addition to when `wordsLoading` is true), preventing the flash of the empty state
- The flag is set in all code paths that process words: `setSelectedWords()`, the devConfig branch, and the empty-list-after-loading case
- The flag resets when the active list changes (e.g. "Test All Lists") so re-initialization works correctly

## Files Modified

- `web-client/src/containers/TestWords/TestWords.tsx` — Added `wordsInitialized` state flag and updated render condition
- `web-client/src/containers/TestWords/TestWords.test.tsx` — Added unit test verifying no flash of "No words due" during initialization
- `web-client/e2e/test-loading-screen.spec.ts` — New E2E test suite verifying the loading screen behavior from the user's perspective
