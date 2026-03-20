## Summary

Adds visual tap-affordance styling to clickable word spans in the SentenceRead component, making the tap-to-define feature discoverable on mobile. Previously, there was no visual indication that Chinese words in example sentences were interactive.

## Changes

### Visual Tap Affordance (`SentenceRead.tsx`)
- **Dotted underline**: Clickable word spans now have a subtle `2px dotted` bottom border in the primary dark color (green), signaling interactivity
- **Color differentiation**: Clickable words use `primary.dark` color to visually distinguish them from plain text
- **Entrance animation**: A `tapAffordanceFadeIn` keyframe animation fades in the dotted underline over 0.6s when the sentence first renders, drawing subtle attention to the interactive elements
- **First-use tooltip**: On the first SentenceRead encounter, the hint text reads "Tap any word for its definition" (bold, primary color). After the user taps their first word, it reverts to the subtler "Tap a word to reveal its meaning" and sets `tapHintDismissed` in localStorage so the prominent hint doesn't appear again

### Unit Tests (`SentenceRead.test.tsx`)
- Tests that the first-use hint text appears when `tapHintDismissed` is not set
- Tests that the default hint text appears when `tapHintDismissed` is already set
- Tests that tapping a word dismisses the hint and updates localStorage
- Tests that clickable word spans have the expected interactive attributes

### E2E Tests (`tap-affordance.spec.ts`)
- Tests the first-use hint lifecycle: appears on first visit, dismissed after tapping a word
- Tests that clickable words have the dotted underline visual affordance
- Tests that tapping a word opens its definition popup with pinyin and meaning

## Design Decisions

- **Dotted underline over solid**: A dotted underline is subtler than solid, avoiding visual clutter while still communicating interactivity. This is a common mobile pattern for "tappable text"
- **localStorage for hint dismissal**: Simple, persistent, and doesn't require backend changes. Once a user discovers the feature, the prominent hint goes away permanently
- **No additional dependencies**: All styling uses existing MUI `sx` prop patterns and CSS keyframes — consistent with the rest of the codebase

## Files Modified

- `web-client/src/components/Test/SentenceRead/SentenceRead.tsx` — Visual affordance styles + first-use hint logic
- `web-client/src/components/Test/SentenceRead/SentenceRead.test.tsx` — 4 new unit tests for tap affordance
- `web-client/e2e/tap-affordance.spec.ts` — New E2E test file for tap affordance feature
