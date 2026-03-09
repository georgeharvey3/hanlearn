## 2026-03-09 09:07
**Areas reviewed:** WordCard.tsx, ErrorBoundary.tsx, ProgressBar.tsx, MeaningEditor.tsx, Footer.tsx, ExpBanner.tsx, HowItWorks.tsx, FeatureHighlights.tsx, MainBanner.tsx (Home), SignUpBanner.tsx, MountainLayer.tsx, Logo.tsx, NavigationItem.tsx, Dropdown.tsx, Backdrop.tsx, Buttons.tsx, Spinner.tsx, Table.tsx, TableRow.tsx, TestSummary.tsx, AddWords.tsx (re-review)
**Issues fixed:**
- Spinner: added `aria-label="Loading"` to CircularProgress — screen readers now announce "Loading" instead of a meaningless role fallback
- MeaningEditor: editable meaning Chips now have `aria-label="Edit meaning: {text}"` so screen reader users know chips are interactive; edit-mode TextField and add-mode TextField both now have `aria-label` since they have no associated `<label>` element
- Dropdown (Settings nav button): added `aria-haspopup="true"` and `aria-expanded` state so screen readers announce the button controls a popup menu
- AddWords: replaced raw `<h2>` / `<h3>` modal headings with MUI `Typography variant="h6"` — consistent with the design system and correct heading hierarchy
- TestSummary: scrollable score list now has `role="list"` + `aria-label="Word scores"` and each row has `role="listitem"` — screen readers can navigate scores as a proper list
**Issues created:**
- DESIGN: MainBanner parallax and text fade transitions ignore `prefers-reduced-motion` — needs design input on a static/reduced fallback layout before implementing (WCAG 2.1 SC 2.3.3). Filed locally; create GitHub issue when gh CLI is available.
**Notes for next run:** All components across components/ and containers/ have now been reviewed at least once. Codebase is in good shape. Next pass focus areas: (1) e2e test coverage for the a11y flows fixed in previous runs, (2) ErrorBoundary coverage — wrap more async-heavy containers (TestWords, TestChengyus), (3) implement prefers-reduced-motion fix for MainBanner once design provides guidance, (4) check if MeaningEditor chip overflow (maxWidth truncation) needs a Tooltip for mouse users.

---

## 2026-03-08 10:48
**Areas reviewed:** SentenceRead.tsx, SentenceWrite.tsx, NewWords.tsx, NewWord.tsx, TestChengyusTest.tsx, TestChengyus.tsx, Dashboard.tsx, WordsDueCard.tsx, StreakCard.tsx, BankDistributionCard.tsx, MasteryCard.tsx, AudioSettingsDrawer.tsx, Button.tsx
**Issues fixed:**
- TestChengyusTest: character `<p onClick>` tags replaced with keyboard-accessible `ButtonBase` with aria-label per character; errorMessage state now rendered with role="alert"; "Show/Hide Answer" button now has aria-pressed; "Click" → "Tap" for mobile-first language
- TestChengyus: added loading spinner while words fetch from Firestore, preventing false "no words to test" modal on slow connections
- BankDistributionCard: bar chart elements now have role=meter + aria-valuenow/min/max/valuetext for screen reader users
- SentenceRead: word popup spans (hover-to-see-meaning) now have role=button, tabIndex=0, onKeyDown handler, and aria-label — keyboard users can now access word definitions; English translation Input now has aria-label
- SentenceWrite: Chinese answer Input now has aria-label
- NewWord: character ButtonBase elements now have aria-label ("Show details for X") and aria-pressed state
- AudioSettingsDrawer: disabled checkboxes append "(not supported by your browser)" to label text — reason visible to all users including screen readers
- Button component: forwarded aria-pressed and aria-label props through to MUI Button
- NewWords: "Click on a character" → "Tap a character" for mobile-first consistency
**Issues created:**
- #91: TestChengyusTest card style inconsistent with NewWord component (design label)
**Notes for next run:** All current components have been reviewed at least once across this and previous runs. Next pass could focus on: ErrorBoundary coverage improvements, ProgressBar accessibility (if it shows numeric progress for screen readers), e2e test coverage for the fixed flows. The `design-review.sh` script at repo root is untracked and may need attention.

---

## 2026-03-05 13:52
**Areas reviewed:** Home.tsx, AccountSummary.tsx, AddWords.tsx (container), MainBanner.tsx (AddWords), AnswerInput.tsx, Test.tsx, TestActions.tsx, QuestionDisplay.tsx, Chengyu.tsx, Settings.tsx, SettingsPage.tsx, AuthModal.tsx, Modal.tsx, FormInput.tsx, Input.tsx, Toggle.tsx, Remove.tsx, PictureButton.tsx, Button.tsx, Toolbar.tsx, DrawerToggle.tsx, SideDrawer.tsx, Sidebar.tsx, NavigationItems.tsx, Layout.tsx, Dashboard.tsx, TestWords.tsx, TestSummary.tsx
**Issues fixed:**
- AccountSummary: showed "0/0 words due" while stats loaded; added Skeleton placeholder and disabled Test button during load (Home.tsx + AccountSummary.tsx)
- AnswerInput: secondary speech fallback input was missing aria-label; added "Type your answer"
- Chengyu quiz: option ListItemButtons had no aria-labels indicating correct/incorrect state; added aria-label per option, aria-live polite region for result announcements, aria-label on character breakdown list
- AddWords: addError state wiped the word table and gave no retry guidance; moved error to inline alert (role="alert") below the form, table is preserved, error clears on next keypress
- Settings: disabled checkboxes (Sound, speech recognition, Stages) had no tooltip explaining WHY disabled; wrapped in Tooltip with browser-support message
**Issues created:**
- #64: Mobile: increase tap target sizes for small interactive elements (design label)
- #65: AccountSummary: improve copy when user has no words in bank (design label)
**Notes for next run:** All key containers and components reviewed. Focus remaining work on: SentenceRead/SentenceWrite (not reviewed this run), NewWords/NewWord components, TestChengyus/TestChengyusTest containers, Dashboard widgets (WordsDueCard, StreakCard, BankDistributionCard, MasteryCard). Pre-existing test failure in auth.test.ts (resetEmailSent missing from initialState snapshot) — not caused by this run.

---
