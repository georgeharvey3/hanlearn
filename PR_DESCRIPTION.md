## Summary

Adds English-to-Chinese translation support in the SentenceWrite ("Write in Chinese") stage. Previously, if a user didn't know an English word in the prompt, they couldn't complete the exercise. Now users can:

- **Tap on one or more English words** in the prompt sentence to select them (with visual highlighting)
- **Press a "Translate" button** to see matching Chinese word(s) with pinyin and meaning
- **Multi-word selection** supports phrases like "carry on" by trying phrase match first, then falling back to individual words

This mirrors the existing Chinese-to-English word lookup in SentenceRead, where users can tap Chinese characters to see their meanings.

## Key Implementation Details

### Translation approach: Sentence-scoped reverse lookup

Rather than building a full reverse English-to-Chinese dictionary index (which would be complex and error-prone), this implementation uses the sentence's own resolved Chinese words. When a sentence is fetched, its Chinese segments are resolved to full dictionary entries via `resolveSentence()`. When the user selects English words and taps Translate, `matchEnglishToSentenceWords()` searches the meaning fields of those ~5-15 resolved words for substring matches. This is simple, fast, and accurate for the sentence context.

### Shared utility extraction

`resolveSentence`, `SentenceWord`, `CloudSentence`, and `ResolvedSentence` were extracted from SentenceRead into a new shared utility (`sentenceUtils.ts`). This avoids code duplication since both SentenceRead and SentenceWrite now need sentence resolution. SentenceRead was updated to import from the shared location.

## Decisions and Trade-offs

- **No "Add to bank" button** on translation results -- this is a hint/helper feature, not vocabulary discovery. Can be added later if requested.
- **Punctuation handling**: Punctuation attached to English words (e.g. "house,") is displayed as-is but stripped for matching purposes.
- **Fallback matching**: If a multi-word phrase doesn't match as a whole, individual words (length > 1 char) are tried separately to maximise usefulness.
- **Translation state resets** when submitting an answer, clicking Yes/No, or fetching a new sentence.

## Files Modified

| File | Change |
|------|--------|
| `web-client/src/utils/sentenceUtils.ts` | **New** -- shared `resolveSentence`, `matchEnglishToSentenceWords`, and type definitions |
| `web-client/src/utils/sentenceUtils.test.ts` | **New** -- unit tests for `matchEnglishToSentenceWords` |
| `web-client/src/components/Test/SentenceWrite/SentenceWrite.tsx` | Major -- tappable English words, translate button, translation display, sentence resolution |
| `web-client/src/components/Test/SentenceWrite/SentenceWrite.test.tsx` | Updated -- added tests for translation feature (word selection, translate button, results display) |
| `web-client/src/components/Test/SentenceRead/SentenceRead.tsx` | Refactored -- imports `resolveSentence`/types from shared utility instead of defining locally |

## Test Plan

- [x] All 673 existing tests pass
- [x] New unit tests for `matchEnglishToSentenceWords` (case insensitivity, phrase matching, no-match, empty input)
- [x] New component tests for translation UI (word selection toggle, translate button visibility, translation display, no-match message)
- [ ] Manual: verify tappable words have adequate touch targets on mobile
- [ ] Manual: verify translation results don't obscure the input field
- [ ] Manual: verify works with both simplified and traditional character sets
