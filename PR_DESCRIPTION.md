## Summary

Implements multiple word lists (Issue #4), allowing users to organize vocabulary into separate lists (e.g., per-book, per-topic). Each user starts with a default "General" list and can create, rename, and delete additional lists. All word operations (add, test, view) are scoped to the active list.

### Changes

**Data model & backend:**
- Added `WordList` interface and `listId` field to `Word` model
- Added `wordLists` subcollection rules to `firestore.rules`
- Added composite Firestore index for `(listId, dueDate)` queries
- New service functions: `getUserWordLists`, `createWordList`, `renameWordList`, `deleteWordList`, `moveWordToList`
- `getUserWords`, `getDueUserWords`, `addWordToBank`, `addCustomWord` now accept optional `listId` parameter

**State management:**
- Extended `AddWordsState` with `lists` and `activeListId`
- New action types: `SET_WORD_LISTS`, `ADD_WORD_LIST`, `REMOVE_WORD_LIST`, `RENAME_WORD_LIST`, `SET_ACTIVE_LIST`
- New thunks: `switchActiveList`, `postCreateWordList`, `postRenameWordList`, `postDeleteWordList`
- `initWords` fetches lists first, then words filtered by active list
- Deleting the active list falls back to the default list

**UI:**
- New `ListSelector` component with MUI Select dropdown and create/rename/delete dialogs
- `ListSelector` shown on Home and AddWords pages when authenticated
- `AccountSummary` shows the active list name
- Default list cannot be renamed or deleted

**Tests:**
- All 43 test files (703 tests) updated and passing
- Test state shapes updated to include `lists` and `activeListId`

## Test plan

- [x] All existing tests pass (43 files, 703 tests)
- [ ] Manual: Create a new list, switch between lists, verify words are scoped
- [ ] Manual: Rename a custom list, verify name updates everywhere
- [ ] Manual: Delete a custom list, verify fallback to default
- [ ] Manual: Add words while on a custom list, verify they appear only in that list
- [ ] Manual: Test words while on a custom list, verify only that list's words are tested

🤖 Generated with [Claude Code](https://claude.com/claude-code)
