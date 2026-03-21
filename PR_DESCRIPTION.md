## Summary

Removes the character-length filter (`word.simp.length < 4`) from the main test flow (`TestWords`), allowing chengyus (4-character idioms) to appear alongside regular words in study sessions.

Previously, the main test explicitly filtered out any word with 4+ characters, restricting chengyus to a separate `TestChengyus` component. This meant users who added chengyus to their word bank could never review them through the normal spaced repetition test flow.

## Changes

### Core fix
- **`web-client/src/containers/TestWords/TestWords.tsx`** (2 locations):
  1. `selectTestWords` callback (line ~107): Removed `nonChengyus` filter — all words in the user's bank are now eligible for test selection
  2. `hasWordsInBank` check (line ~365): Removed `nonChengyus` filter — the Practice button now appears when the bank contains only chengyu-length words

### Unit tests
- **`web-client/src/containers/TestWords/TestWords.test.tsx`**: Added 3 tests:
  - Chengyu words (4+ characters) are included in the test session
  - Mixed chengyus and regular words appear together
  - Practice button shows when only chengyus are in the bank

### E2E tests
- **`web-client/e2e/chengyu-in-test.spec.ts`**: New Playwright spec with 3 tests:
  - Chengyu-only word bank starts a test session successfully
  - Mixed regular words and chengyus appear together and complete to summary
  - Chengyu-only bank shows Practice button when none are due

## Files modified
- `web-client/src/containers/TestWords/TestWords.tsx`
- `web-client/src/containers/TestWords/TestWords.test.tsx`
- `web-client/e2e/chengyu-in-test.spec.ts` (new)
