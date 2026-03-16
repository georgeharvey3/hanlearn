## Summary

Implements cross-list "Test All" study sessions (#191). Users with words spread across multiple lists can now review all due words in a single session, reducing friction for daily review.

### What changed

- **ListSelector**: Added an "All Lists" option at the top of the dropdown when the user has 2+ lists. Shows aggregate due count across all lists. Rename/delete buttons are hidden when "All Lists" is selected.
- **Redux actions** (`word.ts`): `switchActiveList`, `initWords`, and `finishTest` now handle the `'__all__'` sentinel value by fetching words without a `listId` filter (pulling from all lists).
- **TestWords**: Stepper shows "Testing: All Lists" in cross-list mode. Empty state shows a "Test All Lists" chip when the current list has no due words but other lists do. The empty state also correctly handles the `'__all__'` mode.
- **Home**: `activeListName` displays "All Lists" when in cross-list mode.

### Key decisions

- Used `'__all__'` as a sentinel value for `activeListId` rather than adding a separate boolean flag. This keeps the state shape simple and works naturally with existing `switchActiveList` flow.
- No changes needed to `wordService.ts` — `getUserWords()` already supports omitting the `listId` parameter to fetch all words.
- The "All Lists" option appears in the ListSelector dropdown only when the user has at least 2 lists (one non-default), matching the issue requirement.

### Files modified

- `web-client/src/store/actions/word.ts` — Handle `'__all__'` in `switchActiveList`, `initWords`, `finishTest`
- `web-client/src/components/UI/ListSelector/ListSelector.tsx` — Add "All Lists" menu item with aggregate due count
- `web-client/src/containers/TestWords/TestWords.tsx` — Cross-list stepper label, "Test All Lists" chip in empty state
- `web-client/src/containers/Home/Home.tsx` — "All Lists" display name
- `web-client/src/components/UI/ListSelector/ListSelector.test.tsx` — Tests for All Lists rendering and button visibility
- `web-client/src/containers/TestWords/TestWords.test.tsx` — Tests for cross-list stepper, empty state, and Test All chip
