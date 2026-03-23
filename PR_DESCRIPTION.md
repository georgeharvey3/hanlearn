## Summary

Fixes #260 — The submit button on the AddWords page did not trigger a word search when clicked. Only the Enter key worked, which was unclear to users.

**Root cause:** The custom `Button` component had its own `type` prop for visual styling (primary/secondary/ghost), which shadowed the HTML button `type` attribute. The button inside the search form never received `type="submit"`, so clicking it did not trigger form submission.

**Changes:**
- Added `htmlType` prop to the `Button` component to pass through the HTML `type` attribute (`button`/`submit`/`reset`) to the underlying MUI `<Button>`
- Set `htmlType="submit"` on the AddWords search button so clicking it triggers form submission
- Changed button text from "Submit" to "Search" for clearer affordance — the button searches the dictionary, it doesn't submit a word

## Files modified

- `web-client/src/components/UI/Buttons/Button/Button.tsx` — Added `htmlType` prop that maps to MUI Button's `type` attribute
- `web-client/src/components/AddWords/MainBanner.tsx` — Set `htmlType="submit"` and changed label from "Submit" to "Search"
- `web-client/e2e/pages/add-words.page.ts` — Updated `submitButton` locator to match new "Search" label
- `web-client/e2e/add-words-submit.spec.ts` — New E2E tests covering: button label, disabled/enabled states, and click-to-search functionality

## Test plan

- [x] All 1121 existing unit tests pass
- [ ] E2E: Search button displays "Search" text
- [ ] E2E: Search button is disabled when input is empty
- [ ] E2E: Search button is enabled after typing
- [ ] E2E: Clicking Search button triggers word search and shows results
