## 2026-03-08 19:56
**Coverage before:** 536 tests passing, AnswerInput.tsx 21.62%, FormInput.tsx 71.42%, useTestEngine.ts 35.89%
**Gaps addressed:**
1. AnswerInput.tsx (21.62% → 78.37%) — pinyin+speech recognition mode (micInput, typingInputWithMicToggle), meaning+flashcards mode (Show Answer / like/dislike buttons), meaning+English speech recognition mode, micInput interactions (Switch to typing/speaking buttons), all branches of getVerb() helper
2. useTestEngine.ts qNum effect lines 1022-1023 — setHanziWriter path when answerCategory='character' and answer is a string; confirmed non-character and array-answer paths skip HanziWriter.create; qNum state reset verified
3. FormInput.tsx (71.42% → 100%) — select variant (lines 29-50): label rendering, option display via dropdown, error helper text; text/textarea variants

**Tests added:**
- `components/Test/AnswerInput.extra.test.tsx` (23 tests, new file)
- `components/Test/useTestEngine.extra.test.ts` (5 tests, new file)
- `components/UI/FormInput/FormInput.test.tsx` (11 tests, new file)

**Coverage after:** 576 tests passing, AnswerInput.tsx 78.37%, FormInput.tsx 100%, useTestEngine.ts 38.6%; overall statements ~74.28%
**Notes for next run:** Remaining high-value gaps: `useTestEngine.ts` (38.6% — speech/recording paths, submitSpeech, onCorrectAnswer for character mode), `SentenceRead.tsx` (61.84% — word lookup overlay, Next sentence nav, seenOffsets tracking), `TestWords.tsx` (70.73% — stage transitions read→write→summary), `Toggle.tsx` (50%), `SentenceWrite.tsx` (71.65% — audio/speech branches).

---

## 2026-03-08 16:40
**Coverage before:** 68.15% statements, 53.16% branches, 64.34% functions, 69.13% lines (449 tests passing)
**Gaps addressed:**
1. Settings.tsx (10.44% → ~82%) — localStorage initialisation, charSet/priority radio changes, checkbox toggles, mutual-exclusion rules (English speech ↔ flashcards; handwriting-off resets priority to none), slider persistence, speech/synth availability gating, Only Priority enabled/disabled state
2. Chengyu.tsx (2.5% → ~85%) — initial render, correct answer transitions to finished state + character breakdown, incorrect answer marks option red without finishing, character meanings displayed via lookupCharacterMeanings, aria-live announcement, recover from wrong guess
3. AddWords.tsx (61.59% → ~79%) — error state display (with words in bank), network-error alert on failed search, Hide/Show table toggle, confirm modal Add button dispatches addWordToBank, custom-word meaning-input flow calls addCustomWord

**Tests added:**
- `components/Settings/Settings.test.tsx` (30 tests, new file)
- `components/Home/Chengyu/Chengyu.test.tsx` (12 tests, new file)
- `containers/AddWords/AddWords.test.tsx` (9 new tests appended)

**Coverage after:** 72.18% statements, 59.79% branches, 68.52% functions, 73.25% lines (514 tests passing)
**Notes for next run:** Remaining high-value gaps: `useTestEngine.ts` (32.27% — HanziWriter/speech/recording paths), `SentenceRead.tsx` (61.84% — word lookup overlay, Next sentence nav, seenOffsets tracking), `SentenceWrite.tsx` (71.65% — needs more branch coverage for audio/speech paths), `TestWords.tsx` (70.73% — stage transitions read→write→summary via mock callbacks).

---

## 2026-03-07 11:02
**Coverage before:** 61.27% statement coverage (367 tests passing across 27 files)
**Gaps addressed:**
1. NewWords component (4.54% → 100%) — heading/subtitle, Previous Word disabled at index 0, Next Word advances, label switches to "Start Test" on last word, startTest callback called, ArrowRight/ArrowLeft keyboard navigation including boundary no-ops
2. TestSummary component (28.57% → 100%) — Session Summary heading, plural/singular word count, all five score label variants rendered, Home button navigates to "/"
3. MeaningEditor component (32.35% → 97%) — readOnly hides Add/delete, chip click enters edit mode, Enter/Escape/blur save and cancel, empty edit removes chip, delete icon removes meaning, Add chip opens input, Enter/Escape/blur in Add field, blank input no-op

**Tests added:**
- `components/Test/NewWords/NewWords.test.tsx` (13 tests, new file)
- `components/Test/TestSummary/TestSummary.test.tsx` (12 tests, new file)
- `components/UI/MeaningEditor/MeaningEditor.test.tsx` (18 tests, new file)

**Coverage after:** 63.96% statement coverage (408 tests passing across 30 files)
**Notes for next run:** Remaining low-coverage areas: Chengyu.tsx (2.5%, 16-168 uncovered — cloud function call + quiz UI), Home.tsx (62.96%), store/actions/auth.ts (78.65% — lines 145/175/191/196), devTestMode.ts (14.28%), NewWord sub-component (45.28% — character click + speech paths). TestWords stage transitions (vocab→read→write→summary) would push TestWords toward 90%+.

---

## 2026-03-06 11:01
**Coverage before:** 49.12% statement coverage (328 tests passing across 24 files)
**Gaps addressed:**
1. TestWords container (4.06% → 70.73%) — auth guard redirect, no-words-due empty state, Add Words/Practice button visibility, initWords called on mount (not in demo mode), demo bypass, due-word/new-word stage selection, stepper labels (Learn/Test/Practice/Done), practice mode start
2. SentenceRead component (3.55% → 62.66%) — loading spinner, sentence card display, input field, Prev/Next navigation button disabled states, translation submit triggers comparison view, yes/no post-submission buttons, No resets to input, Yes advances word/calls startSentenceWrite, skip-word when no sentences, startSentenceWrite called when all words have no sentences
3. SentenceWrite component (3.93% → 71.65%) — loading spinner, English prompt display, target-word badge, answer input, submit comparison view, yes/no buttons, No resets input, empty-input no-submit guard, Yes calls onComplete on last word, fetches next word on advance, skips words with no sentences, seenOffset respected (starts at offset+1)

**Tests added:**
- `containers/TestWords/TestWords.test.tsx` (13 tests, new file)
- `components/Test/SentenceRead/SentenceRead.test.tsx` (12 tests, new file)
- `components/Test/SentenceWrite/SentenceWrite.test.tsx` (14 tests, new file)

**Coverage after:** 61.27% statement coverage (367 tests passing across 27 files)
**Notes for next run:** TestSummary (28.57%), NewWords (4.54%), MeaningEditor (32.35%), Home container (62.96%) are next priorities. TestWords stage transitions (vocab→read→write→summary via mock callbacks) would push TestWords toward 90%+. The Howl class mock pattern and factory-style service mocks (needed for modules with top-level Firebase/AI init) are now established patterns.

---

