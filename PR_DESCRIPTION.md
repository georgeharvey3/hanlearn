## Summary

Adds comprehensive accessibility (WCAG 2.1 AA) support to HanLearn, including automated a11y testing infrastructure, `lang` attributes for Chinese content, skip navigation, focus indicators, reduced motion support, and semantic HTML fixes.

Closes #50

## Changes

### Testing Infrastructure
- **vitest-axe** + **@axe-core/playwright** added as dev dependencies for component-level and E2E accessibility testing
- Configured `toHaveNoViolations()` matcher in `setupTests.ts` via `vitest-axe/matchers`
- Created `src/test/a11y.ts` helper for reusable axe assertions
- Added axe-core assertions to existing test suites: AuthModal (3 modes), Chengyu, Settings
- Created `e2e/accessibility.spec.ts` with Playwright + axe-core E2E tests covering home page audit, skip link, main landmark, lang attributes, and keyboard navigation

### Skip-to-Main-Content Link
- New `SkipLink` component — visually hidden, appears on focus, targets `#main-content`
- Integrated as first child in `Layout.tsx`
- Added `id="main-content"` to the main `<Container>`

### Focus Indicators
- Global `focus-visible` outline style (`2px solid #1a5c40`) via MUI `CssBaseline` and `MuiButtonBase` overrides in `theme.ts`
- Ensures all interactive elements have visible focus indicators for keyboard users

### Language Attributes (`lang="zh"`)
- Added `lang="zh"` to Chinese character elements across: Chengyu, QuestionDisplay, TestSummary, NewWord, WordCard
- Added `lang="zh-Latn"` to pinyin text elements for correct screen reader pronunciation
- QuestionDisplay dynamically sets `lang` based on question category (character vs pinyin vs meaning)

### Spinner Accessibility
- Added `role="status"` and `aria-label="Loading"` to Spinner component so screen readers announce loading state

### Reduced Motion Support
- MainBanner respects `prefers-reduced-motion: reduce` — disables parallax scrolling, shows first section statically, removes CSS transitions
- Safe fallback when `matchMedia` is unavailable (jsdom/SSR)

### Semantic HTML Fix
- Changed Chengyu answer options from `<ul>` + `<div role="button">` to `<div role="group">` + `<div role="button">` to fix axe list-child violation

## Key Decisions

- **vitest-axe matchers registration**: The `extend-expect` module in vitest-axe 0.1.0 is empty; used `expect.extend()` with `vitest-axe/matchers` instead
- **Chengyu answer list**: Changed from `<ul>` to `<div role="group">` because MUI's `ListItemButton` renders as `<div role="button">` which violates the axe `list` rule when inside a `<ul>`
- **No separate CI job**: A11y unit tests run as part of the existing `unit-tests` CI job; E2E a11y tests run as part of `e2e-tests`. A dedicated job would be redundant
- **`lang="zh-Latn"`** for pinyin: Uses the BCP 47 subtag for Chinese written in Latin script, enabling screen readers to apply correct pronunciation rules

## Files Modified

### New Files
- `web-client/src/components/Layout/SkipLink.tsx` — Skip-to-main-content link
- `web-client/src/test/a11y.ts` — Shared a11y test helper
- `web-client/e2e/accessibility.spec.ts` — E2E accessibility tests

### Modified Files
- `web-client/package.json` / `package-lock.json` — Added vitest-axe, @axe-core/playwright
- `web-client/src/setupTests.ts` — Registered vitest-axe matchers
- `web-client/src/theme.ts` — Global focus-visible styles
- `web-client/src/components/Layout/Layout.tsx` — SkipLink + main content id
- `web-client/src/components/UI/Spinner/Spinner.tsx` — role="status", aria-label
- `web-client/src/components/Home/MainBanner/MainBanner.tsx` — prefers-reduced-motion
- `web-client/src/components/Home/Chengyu/Chengyu.tsx` — lang="zh", semantic fix
- `web-client/src/components/Test/QuestionDisplay.tsx` — lang attributes
- `web-client/src/components/Test/TestSummary/TestSummary.tsx` — lang="zh"
- `web-client/src/components/Test/NewWords/NewWord/NewWord.tsx` — lang="zh", lang="zh-Latn"
- `web-client/src/components/AddWords/WordCard.tsx` — lang="zh", lang="zh-Latn"
- `web-client/src/components/Auth/AuthModal.test.tsx` — axe assertions
- `web-client/src/components/Home/Chengyu/Chengyu.test.tsx` — axe assertion
- `web-client/src/components/Settings/Settings.test.tsx` — axe assertion

## Test Results

All 931 tests pass (57 test files), including 5 new accessibility assertions.
