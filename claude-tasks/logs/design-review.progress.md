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
