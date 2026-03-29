## Summary

Adds a visible Submit button to both the SentenceRead ("Listen & translate") and SentenceWrite ("Write in Chinese") stages, addressing issue #273. Previously, users had to press the Enter/return key to submit their input, which was not discoverable — especially on mobile devices.

## Changes

- **SentenceRead**: Added a "Submit" button below the translation input. The button is disabled when the input is empty and triggers the same submission logic as pressing Enter.
- **SentenceWrite**: Added a "Submit" button below the Chinese answer input. Same disabled-when-empty behavior.
- **Placeholder text updated**: Removed "and press Enter" from input placeholders since the button now provides an obvious submission affordance:
  - SentenceRead: "Type here and press Enter…" → "Type your translation…"
  - SentenceWrite: "Type Chinese and press Enter…" → "Type your answer in Chinese…"
- **Refactored submission logic**: Extracted the core submission logic into standalone functions (`onSubmit` / `onSubmitAnswer`) that are called by both the Enter key handler and the button click handler.

## Key implementation details

- The submit buttons use the existing `Button` component with `aria-label` attributes for accessibility
- Buttons are disabled when input is empty to prevent submitting blank answers
- Enter key submission still works as before (no breaking change for existing users)
- Both unit tests and E2E tests cover the new button functionality

## Files modified

- `web-client/src/components/Test/SentenceRead/SentenceRead.tsx` — Added submit button and refactored submission logic
- `web-client/src/components/Test/SentenceWrite/SentenceWrite.tsx` — Added submit button and refactored submission logic
- `web-client/src/components/Test/SentenceRead/SentenceRead.test.tsx` — Updated placeholder references, added submit button tests
- `web-client/src/components/Test/SentenceRead/SentenceRead.keyboard.test.tsx` — Updated placeholder references
- `web-client/src/components/Test/SentenceWrite/SentenceWrite.test.tsx` — Updated placeholder references, added submit button tests
- `web-client/e2e/sentence-submit-button.spec.ts` — New E2E tests for submit button in both sentence stages
