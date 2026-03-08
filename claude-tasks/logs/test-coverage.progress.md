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

## 2026-03-08 19:15
**Coverage before:** 72.8% statements (537 tests, 37 test files)
**Gaps addressed:**
1. `components/Test/AnswerInput.tsx` (21.62% → 81.08%): 24 new tests covering all `answerCategory` switch branches — `pinyin` with Chinese speech recognition (`micInput` and `typingInputWithMicToggle`), `meaning` with flashcards (Show Answer button, like/dislike buttons), `meaning` with English speech recognition (both mic and typing+toggle modes). Also covers `getVerb()` for all 9 branches. Interactive tests verify `setStateMerged({ useTypingInput })`, `onShowAnswer`, `onCorrectAnswer`, `onIDontKnow`, and `recognition.abort()` callbacks.
2. `components/Test/SentenceRead/SentenceRead.tsx` (61.84% → 71.49%): 7 new tests covering lines 603–661 (word popup rendering). Tests verify: clickable span with aria-label rendered when `searchWord` resolves a SentenceWord; popup content (pinyin/meaning) in hidden div; "Add to bank" button visible after clicking popup span; disabled "Added!" button when word is already in `addedWords`; decomposed array rendering when `substringMatch` returns 2+ items (lines 647–658).
3. Pre-existing flaky test fixes: `Test.test.tsx` — mock `SpeechSynthesisUtterance` and spy on `speechSynthesis.cancel/speak` to handle non-deterministic `assignQA` picking `questionCategory: 'pinyin'`. `AuthModal.test.tsx` — use `userEvent.setup({ delay: null })` for two typing tests that timed out in coverage-instrumented runs.

**Tests added:**
- `web-client/src/components/Test/AnswerInput.test.tsx` (24 new tests appended)
- `web-client/src/components/Test/SentenceRead/SentenceRead.test.tsx` (7 new tests appended)
- `web-client/src/components/Test/Test.test.tsx` (robustness fixes, no new tests)
- `web-client/src/components/Auth/AuthModal.test.tsx` (robustness fixes, no new tests)

**Coverage after:** 74.65% statements (566 tests passing across 37 test files); AnswerInput.tsx 81.08%, SentenceRead.tsx 71.49%, overall +1.85pp

**Notes for next run:** `useTestEngine.ts` remains at 35.89% — the HanziWriter paths (quizWriter/animateWriter), submitSpeech full flow, and qNum effect are the biggest remaining gaps. `SentenceRead.tsx` still has lines 640 (postWord after Add to bank click), 786–793 (navigation with cached sentences) uncovered. Key pattern: popup buttons are inside `visibility:hidden` spans — click the parent span first to open popup before querying buttons.

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
## 2026-03-08 20:11
**Coverage before:** 72.8% statements (537 tests, 37 test files)
**Gaps addressed:**
1. `AnswerInput.tsx` (21.62% → 86.48%): 27 new tests covering pinyin+Chinese speech recognition mic mode (mic button renders, no secondary input by default, secondary input when showInput=true, onListen called on click, Switch to typing/speaking buttons), meaning+flashcards (Show Answer renders, onShowAnswer called, like/dislike buttons, onCorrectAnswer and onIDontKnow called, fail.play on dislike with useSound=true), meaning+English speech (mic vs typing vs plain text input), and all `getVerb()` branches (9 cases)
2. `TestWords.tsx` (70.73% → 82.11%): 4 new stage-transition tests using a module-level prop-capture ref on the mocked Test component — transitions to read stage via startSentenceRead, to write stage when sentenceReadEnabled=false, to summary via onVocabComplete, and Practice step visible in stepper
3. `useTestEngine.ts` (35.89% → 42.66%): 4 new qNum-effect tests — autoRecord triggers onListen for pinyin, autoRecord triggers onListen for meaning (not flashcards), flashcards guards onListen, and setHanziWriter called when answerCategory=character (uses vi.spyOn for speechSynthesis per jsdom constraint)

**Tests added:**
- `web-client/src/components/Test/AnswerInput.test.tsx` (29 tests, extended from 2)
- `web-client/src/containers/TestWords/TestWords.test.tsx` (4 tests appended)
- `web-client/src/components/Test/useTestEngine.test.ts` (4 tests appended)
- `web-client/src/components/Test/SentenceRead/SentenceRead.test.tsx` (4 tests appended for text-mode rendering)

**Notes for next run:** `useTestEngine.ts` at 42.66% — large uncovered block still around lines 800–954 (keyboard shortcuts: onKeyUp handler with most key cases), and lines around animateWriter/quizWriter/onIdkChar. `SentenceRead.tsx` at 66.22% — lines 611–640 (word popup click/keyboard interaction) and 786–793 (Prev/Next nav row) still uncovered. `TestWords.tsx` at 82.11% — lines 329-333 (devConfig spinner path) remain low-value. Consider targeting `useTestEngine` onKeyUp shortcuts (ArrowUp/Down, p, a, h, s, i keys via document.keyup dispatch) for the next highest-value gain.

---

## 2026-03-08 18:30
**Coverage before:** 72.06% statements (514 tests, 36 test files)
**Gaps addressed:**
1. `components/Test/useTestEngine.ts` (32.27% → 65.91%): 41 new tests in `useTestEngine.extra.test.ts` covering previously unreachable paths — onListen speech recognition event flow (audiostart/audioend/end/result), submitSpeech correct match (chosenCharacter and meaning array), wrong-tones path (numSpeakTries gate for showInput), completely-wrong path, onFinishTest full score calculation (0–4 scale, capped at 4 IDKs), onSendScores called vs omitted for demo/practiceMode, HanziWriter quizWriter (create→quiz→onComplete→advance char or onCorrectAnswer), animateWriter via onIdkChar (cancelQuiz→animateCharacter), qNum effect (speechSynthesis.cancel always called, onListen triggered by useAutoRecord), onSpeak (speak called, synthesis-failed sets showPinyin), showSentenceHint (getHintSentence called, null result, reject), refreshSettings synthAvailable/speechAvailable gates, keyboard shortcuts (ctrl+i, ArrowUp, h, p via document.body dispatch)

**Tests added:**
- `web-client/src/components/Test/useTestEngine.extra.test.ts` (41 tests, new file)

**Coverage after:** 78.42% statements (555 tests passing across 37 test files); useTestEngine.ts 65.91%, overall +6.4pp

**Notes for next run:** `useTestEngine.ts` still has uncovered lines around lines 994–1025 (qNum effect: setHanziWriter path when answerCategory=character in effect — hard because it's non-deterministic). `AnswerInput.tsx` (21.62%) has many uncovered branches (lines 174–177, 181–206 — pinyin+speech, meaning+flashcards, meaning+speech variants). `SentenceRead.tsx` (61.84%) has lines 603–661 and 786–793 uncovered — text-mode word popup rendering with addedWords chip. Key pattern discovered: `vi.stubGlobal('speechSynthesis', ...)` fails because jsdom defines it as non-configurable — use `vi.spyOn(window.speechSynthesis, 'cancel')` instead. `webkitSpeechRecognition` must be a class (not `vi.fn(() => mock)`) — create a `class FakeRecognition` that delegates to the shared mock instance. For stateRef to reflect `setStateMerged` overrides before recognition events fire, call `setStateMerged` in one `act()` block, then set up the mock and call `onListen` in a second `act()`.

---

<<<<<<< HEAD
## 2026-03-08 17:37
**Coverage before:** 72.18% statements (493 tests, 35 test files)
**Gaps addressed:**
1. `components/Test/SentenceRead/SentenceRead.tsx` (61.84% → 81.14%): text mode segmented word rendering, word popup with addedWords chip state (Add to bank vs Added!), Show/Hide text chip toggle, Next/Prev sentence navigation (button + ArrowRight keyboard shortcut), cached sentence reuse on Back (no redundant fetches)
2. `components/Test/SentenceWrite/SentenceWrite.tsx` (71.65% → 77.16%): ArrowUp/Down keyboard shortcuts for yes/no, seenOffsets duplicate-sentence skipping, offset fallback (tryOffset > 0 returns null → try offset 0)
3. `containers/TestWords/TestWords.tsx` (70.73% → 87.8%): full stage transition chain (vocab→read→write→summary), onStartSentenceRead skipping to write when sentenceRead disabled, onStartSentenceWrite skipping to summary when sentenceWrite disabled, stepper Practice step visibility based on enabled stages

**Tests added:**
- `web-client/src/components/Test/SentenceRead/SentenceRead.extra.test.tsx` (12 tests, new file)
- `web-client/src/components/Test/SentenceWrite/SentenceWrite.extra.test.tsx` (6 tests, new file)
- `web-client/src/containers/TestWords/TestWords.extra.test.tsx` (8 tests, new file)

**Coverage after:** ~75% statements (540 tests passing across 39 test files); SentenceRead.tsx 81.14%, SentenceWrite.tsx 77.16%, TestWords.tsx 87.8%

**Notes for next run:** `useTestEngine.ts` remains at 32.27% — the HanziWriter paths (quizWriter/animateWriter), submitSpeech full flow, and the qNum effect (lines 994-1025) are the biggest remaining gaps. Speech/HanziWriter tests require window.HanziWriter mock + window.webkitSpeechRecognition mock. TestWords lines 258/329-333/343 still uncovered (devConfig spinner and default switch case — low value). SentenceRead lines 618/640/648-651 are decomposed-array segment rendering — needs substringMatch to return multi-word results.

---

## 2026-03-08 17:20
**Coverage before:** 68.28% statements (473 tests, 34 test files) — based on last run
**Gaps addressed:**
1. `containers/AddWords/AddWords.tsx` (61.59% → 72.46%): 7 new tests — confirmAddWord calls postWord with original word and closes modal, clash table row click transitions to confirm modal, toggle show/hide table (Hide Table hides rows, Show Table restores them), search error shows alert role
2. `components/Test/useTestEngine.ts` (32.27% → 35.89%): 20 tests in new Test.test.tsx — refreshSettings respects synthAvailable/speechAvailable flags (6 tests), onToggleShowPinyin only acts when questionCategory==='pinyin' (4 tests), showCharacter toggle result (3 tests), onInputChanged updates answerInput and sets pauseAutoRecord (2 tests), onKeyPress guards (empty input, submitDisabled, non-Enter key) and happy-path submit (5 tests)

**Tests added:**
- `web-client/src/components/Test/Test.test.tsx` (20 tests, new file — tests useTestEngine hook paths)
- `web-client/src/containers/AddWords/AddWords.test.tsx` (7 tests appended to existing file)

**Coverage after:** All 493 tests passing across 35 test files; AddWords.tsx 72.46%, useTestEngine.ts 35.89%

**Notes for next run:** Remaining high-value gaps: `components/Test/useTestEngine.ts` (35.89% — HanziWriter quizWriter/animateWriter paths, onSendScores, onFinishTest with sentenceWords, submitSpeech full flow), `components/Test/SentenceRead.tsx` (61.84% — text mode word popup rendering, addedWords chip, onChangeSentence, onShowPopup), `components/Test/SentenceWrite.tsx` (71.65% — keyboard shortcuts, seenOffsets duplicate skip), `containers/TestWords/TestWords.tsx` (70.73%). Speech/HanziWriter paths in useTestEngine require window.HanziWriter and window.webkitSpeechRecognition mocks — use Object.defineProperty only if configurable, otherwise set directly on window. The `webkitSpeechRecognition` property may already be non-configurable in jsdom — skip deletion in afterEach.

---

## 2026-03-08 17:05
**Coverage before:** 68.28% statements (468 tests, 34 test files)
**Gaps addressed:**
1. `components/Settings/Settings.tsx` (10.44% → 94.02%): 27 tests — all section labels render, charSet radio read/save, numWords display, Sound/speech rec disabled by capabilities, English SR ↔ flashcards mutual exclusion, handwriting-off resets priority/onlyPriority, Writing radio disabled when handwriting off, Only Priority checkbox disabled/enabled, stage checkboxes disabled by capabilities, localStorage persistence for all interactions
2. `components/Home/Chengyu/Chengyu.tsx` (62.5% → 100%): 14 tests — initial render (heading, characters, all 4 options), correct answer flow (quiz finishes, aria-live announcement, character breakdown list appears, incorrect options hidden via aria-disabled), incorrect answer flow (option marked incorrect, Incorrect announcement, can still click correct, multiple wrong answers), character meanings shown after lookupCharacterMeanings resolves
3. `components/AddWords/WordCard.tsx` (20% → 100%): 9 tests — simp/trad character rendering, pinyin, meaning via MeaningEditor, due date presence/absence, remove button callback with correct id, meaning editor update callback with id and new text

**Tests added:**
- `web-client/src/components/Settings/Settings.test.tsx` (27 tests, new file)
- `web-client/src/components/Home/Chengyu/Chengyu.test.tsx` (14 tests, new file)
- `web-client/src/components/AddWords/WordCard.test.tsx` (9 tests, new file)

**Coverage after:** 71.24% statement coverage (518 tests passing across 37 test files); Settings.tsx 94.02%, Chengyu.tsx 100%, WordCard.tsx 100%
**Notes for next run:** Remaining high-value gaps: `components/Test/Test.tsx` (22.22%), `components/Test/useTestEngine.ts` (32.27% — HanziWriter/speech paths), `containers/AddWords/AddWords.tsx` (61.59% — confirmAddWord with edited meaning, clashTable row interaction, toggle show/hide table), `components/Test/SentenceRead.tsx` (61.84%), `components/Test/SentenceWrite.tsx` (71.65%). Settings.tsx lines 133-138 (onSliderChange) remain uncoverable — MUI Slider doesn't fire standard onChange via fireEvent. Chengyu mock pattern: mock `../../../data/chengyus` and `../../../services/dictionaryService` separately. Word type is FLAT.

---

## 2026-03-08 15:51
**Coverage before:** 64.16% statements (401 tests, 31 test files)
**Gaps addressed:**
1. `firebase/auth.ts` (76% → 100%): 7 tests — signInWithGoogle calls signInWithPopup and returns user, creates Firestore doc on first sign-in, skips doc creation when already exists, email fallback username when displayName null, error propagation; resetPassword resolves without value, propagates errors
2. `store/actions/auth.ts` (80% → 100%): 15 tests — sendPasswordReset success, user-not-found anti-enumeration, invalid-email, non-Firebase fallback; googleSignIn popup-blocked, account-exists-with-different-credential, cancelled-popup-request (empty string), non-Firebase; register non-Firebase fallback; getErrorMessage all remaining codes (user-not-found, wrong-password, too-many-requests, user-disabled, operation-not-allowed, default branch)
3. `utils/devTestMode.ts` (14.28% → 100%): 16 tests — production/test env guards, absent/empty devStage, invalid stage + console.warn, all 5 valid stages, testFinished=true only for summary, extra params ignored, isDevTestMode and getDevStage helpers
4. `containers/Home/Home.tsx` (62.96% → 92.59%): 10 tests — initWords dispatched on auth (not unauth), Chengyu/AccountSummary shown when auth, numDue calculation (null/past/today/future due dates), navigation to /test-words and /add-words

**Tests added:**
- `web-client/src/firebase/auth.test.ts` (7 tests appended — signInWithGoogle 5, resetPassword 2)
- `web-client/src/store/actions/auth.test.ts` (15 tests appended)
- `web-client/src/utils/devTestMode.test.ts` (16 tests, new file)
- `web-client/src/containers/Home/Home.test.tsx` (10 tests, new file)

**Coverage after:** 66% statement coverage (449 tests passing across 33 test files); firebase/auth.ts 100%, store/actions/auth.ts 100% stmts, devTestMode.ts 100%, Home.tsx 92.59%
**Notes for next run:** Remaining high-value gaps: `components/Test/Test.tsx` (22.22%), `components/Test/useTestEngine.ts` (32.27% — HanziWriter/speech paths), `components/Home/Chengyu/Chengyu.tsx` (2.5%), `components/Settings/Settings.tsx` (10.44%), `containers/AddWords/AddWords.tsx` (61.9%), `components/Test/SentenceRead.tsx` (62.66%), `components/Test/SentenceWrite.tsx` (71.65%). Home.tsx lines 62/66 still uncovered (tryOut/signUp nav — need unauthenticated render with MainBanner button clicks). Key patterns established: mock `../../firebase/config` in Home test to prevent Firebase init; mock `../../components/Home/Chengyu/Chengyu` to avoid dictionaryService transitive; mock `../../store/actions/index` with direct vi.fn thunk factories (NOT importOriginal); use createMemoryHistory+Router for navigation assertions; word type is FLAT (id, simp, trad, pinyin, meaning, due_date).


## 2026-03-06 10:25
**Coverage before:** 49.12% statement coverage (328 tests passing across 24 files)
**Gaps addressed:**
1. Settings component (10% → ~85%) — localStorage persistence, charSet/slider/checkbox changes, mutual exclusions (English speech rec ↔ flashcards, handwriting-off resets priority), Redux-driven disabled states
2. TestWords container (4% → 65%) — auth guard redirect, empty-bank UI, Add Words/Practice button visibility, initWords called on mount, stepper step labels, demo mode bypass
3. useTestEngine onFinishTest (internal function, 32% → higher) — score calculation with 0/2/6+ IDKs, score capping at 4, demo/practice mode skip dispatch, onVocabComplete fires when no sentence words, sentence availability check, startSentenceRead call, finalStage=true skips sentence read, sentenceCheckStatus transitions

**Tests added:**
- `components/Settings/Settings.test.tsx` (25 tests, new file)
- `containers/TestWords/TestWords.test.tsx` (13 tests, new file)
- `components/Test/useTestEngine.test.ts` (12 new tests appended — onFinishTest suite)

**Coverage after:** 55.95% statement coverage (378 tests passing across 26 files)
**Notes for next run:** Settings, TestWords, Dashboard already well covered. Next priorities: SentenceRead (3.55%), SentenceWrite (3.93%), NewWords (4.54%) — large untested components. Also TestWords sub-stage transitions (vocab→read→write→summary) and useTestEngine speech/recording paths.
