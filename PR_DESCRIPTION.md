## Summary

Fixes #200 — Chengyu example sentences and character meanings are now cached locally so they remain consistent throughout the day and across all users.

### Root cause

The `chengyuSentences` Firestore collection had **no security rules**, so cache reads and writes were silently rejected. This caused the AI to generate a new sentence on every component mount. Similarly, character meaning lookups called Cloud Functions on every view.

### Changes

**Firestore rules** (`firestore.rules`):
- Added read/write rules for the `chengyuSentences` collection (public read, authenticated write with field validation), so the Firestore cache actually works across users.

**Chengyu sentence service** (`web-client/src/services/chengyuSentenceService.ts`):
- Added a localStorage caching layer that stores the current chengyu's sentence. On subsequent views within the same day (or until the chengyu rotates), the sentence is served instantly from localStorage without any network calls.
- Firestore still serves as the cross-user cache — the first user to view a chengyu generates the sentence, and all subsequent users (and views) get the same one.

**Chengyu character meanings service** (`web-client/src/services/chengyuService.ts`):
- Added localStorage caching for character meaning lookups, keyed by the characters + charSet. This avoids repeated Cloud Function calls for the same chengyu breakdown.

**Tests** (`web-client/src/services/chengyuSentenceService.test.ts`):
- Added `localStorage.clear()` to all `beforeEach` blocks to prevent cached state from leaking between tests.
- Added 2 new tests: one verifying localStorage cache hits bypass Firestore entirely, and one verifying localStorage is populated after a Firestore cache hit.

### Files modified

- `firestore.rules` — Added `chengyuSentences/{chengyu}` rules
- `web-client/src/services/chengyuSentenceService.ts` — localStorage caching layer
- `web-client/src/services/chengyuService.ts` — localStorage caching for character meanings
- `web-client/src/services/chengyuSentenceService.test.ts` — Fixed test isolation, added caching tests
