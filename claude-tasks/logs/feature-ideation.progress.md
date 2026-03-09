## 2026-03-09 09:27
**Features proposed:** (1) Struggling words indicator on dashboard — surface words stuck at bank 1 after repeated resets; (2) Quick-retry failed words after session — re-quiz words scored <3 immediately after TestSummary; (3) Manual bank level adjustment in word bank — let users promote/demote a word's bank level from the WordCard UI
**Issue created:** N/A — `gh` CLI not available in this environment; issue body drafted below for manual creation
**Reasoning:** Manual bank adjustment selected — explicitly called out in "Next" roadmap ("allow manual bank adjustment"), highest legitimacy, no new data model needed (bank + dueDate already exist), natural fit into existing WordCard component
**Notes for next run:** Avoid re-proposing: manual bank adjustment, struggling words dashboard card, quick-retry failed words. Previously proposed: due-date countdown (#73), bank level column, next-review date in TestSummary. Consider: dashboard learning statistics/progress charts, chengyu history tracking, amended meaning shown during test review.

### Proposed Issue Body (create manually if gh unavailable)
**Title:** `[Feature Proposal] Manual bank level adjustment in word bank`
**Label:** `feature-proposal`

```
## Summary
Allow users to manually adjust a word's spaced repetition bank level directly from the word bank UI. Currently the algorithm auto-moves words based on test scores, but learners often know when this is wrong — a word feels more familiar than bank 1 suggests, or a word they keep guessing correctly isn't genuinely retained. A simple +/− control on each word card restores learner agency without disrupting the algorithm's normal operation.

## User Value
Solves the frustration of being stuck reviewing words you already know (or skipping words you don't). Benefits all active users with larger word banks who notice misfiled words during sessions.

## Complexity
M (days) — bank and dueDate fields already exist in Firestore; effort is the UI affordance in WordCard.tsx, a new adjustWordBank() service function, and keeping due-date recalculation consistent with BANK_INTERVALS.

## Implementation Outline
- web-client/src/services/wordService.ts — add adjustWordBank(userId, wordId, newBank) updating bank + recalculating dueDate via BANK_INTERVALS
- web-client/src/components/WordCard/WordCard.tsx — show current bank level ("Level 2/5") + +/− icon buttons (disabled at bounds)
- web-client/src/store/actions/addWordsActions.ts — add adjustBankLevel thunk
- No schema changes needed

## Alignment
Directly listed in the **"Next"** roadmap: "Improve spaced repetition: show due-date countdown, allow manual bank adjustment" — this is the second half of that item (first half addressed in #73).

---
*Proposed by Claude Code feature ideation task*
```

### Deduplication Index
```json
{
  "features_proposed": [
    "struggling words indicator on dashboard",
    "quick-retry failed words after session",
    "manual bank level adjustment in word bank"
  ],
  "issue_created": "N/A (gh CLI unavailable)",
  "features_to_avoid": [
    "due-date countdown in word bank table",
    "bank level column in word bank table",
    "show next review date in TestSummary after session",
    "struggling words indicator on dashboard",
    "quick-retry failed words after session",
    "manual bank level adjustment in word bank"
  ]
}
```

---

## 2026-03-05 14:51
**Features proposed:** (1) Due-date countdown in word bank table, (2) Bank level column in word bank table, (3) Show next review date in TestSummary after session
**Issue created:** #73: [Feature Proposal] Show due-date countdown in word bank table
**Reasoning:** Proposal 1 had the best value-to-complexity ratio — S complexity (single helper function in AddWords.tsx), directly called out in the "Next" roadmap priority, and high daily-use visibility. Proposals 2 and 3 are also good but require slightly more wiring.
**Notes for next run:** Avoid re-proposing: due-date countdown (created as #73), bank level column in word bank, next-review date in TestSummary. Consider: manual bank adjustment (roadmap Next), dashboard learning statistics/progress charts (roadmap Next), practice mode discoverability improvements.

### Deduplication Index
```json
{
  "features_proposed": [
    "due-date countdown in word bank table",
    "bank level column in word bank table",
    "show next review date in TestSummary after session"
  ],
  "issue_created": "#73",
  "features_to_avoid": [
    "due-date countdown in word bank table",
    "bank level column in word bank table",
    "show next review date in TestSummary after session"
  ]
}
```

---
