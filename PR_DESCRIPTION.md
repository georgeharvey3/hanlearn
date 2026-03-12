## Summary

Expands E2E test coverage from a single smoke test to comprehensive tests covering all critical user flows, as specified in issue #47. Adds 18 E2E tests across 5 test suites, page objects for maintainability, expanded seed fixtures, and CI integration.

## What was changed

### Test Suites (5 new spec files)

- **Auth flow** (`auth.spec.ts`) — Register, login, logout, invalid credentials, mode switching
- **Word management** (`word-management.spec.ts`) — Add word from dictionary, view pre-seeded word bank, search results
- **Study flow** (`study-flow.spec.ts`) — Complete test session, weak scores, no-words-due message, practice mode, empty bank redirect
- **Spaced repetition** (`spaced-repetition.spec.ts`) — Bank reset on incorrect answers, Firestore state verification after test completion
- **Chengyu** (`chengyu.spec.ts`) — Daily challenge loads, correct answer reveals breakdown, wrong answer feedback, save to word bank

### Infrastructure

- **Seed fixtures** (`e2e/fixtures/seed.ts`) — `clearEmulatorData()`, `seedTestUser()`, `seedWords()`, `readWordFromFirestore()`, `loginViaUI()`, `configureTestSettings()` helpers using Firebase emulator REST APIs
- **Page objects** (`e2e/pages/`) — `AuthPage`, `AddWordsPage`, `TestWordsPage`, `DashboardPage` for selector encapsulation
- **Global setup** (`e2e/global-setup.ts`) — Emulator health check before tests run
- **Playwright config** — Added `globalSetup`, increased `actionTimeout` and `webServer.timeout` for CI stability
- **CI workflow** — New `e2e-tests` job that runs after unit tests and build pass, with emulator startup and Playwright report artifact upload

## Key decisions

- **Speech features disabled via localStorage** — Playwright's Chromium doesn't support Web Speech API, so all speech/sound features are disabled in test settings
- **Sentence stages disabled** — Simplifies the test flow to vocab + summary, avoiding complex sentence read/write interactions
- **"I Don't Know" strategy for test completion** — Character-drawing questions can't be answered programmatically, so tests use IDK to reliably complete sessions regardless of question type
- **Firestore REST API for seeding and verification** — Direct emulator API calls avoid Firebase SDK dependency in test helpers, and enable precise assertions on bank/dueDate values
- **`clearEmulatorData()` in beforeEach** — Full isolation between tests, each test seeds its own data

## Files modified

| File | Change |
|------|--------|
| `web-client/e2e/fixtures/seed.ts` | Expanded with all seed/cleanup/login helpers |
| `web-client/e2e/pages/auth.page.ts` | New — Auth modal page object |
| `web-client/e2e/pages/add-words.page.ts` | New — Add Words page object |
| `web-client/e2e/pages/test-words.page.ts` | New — Test session page object |
| `web-client/e2e/pages/dashboard.page.ts` | New — Dashboard/chengyu page object |
| `web-client/e2e/auth.spec.ts` | New — 5 auth flow tests |
| `web-client/e2e/word-management.spec.ts` | New — 3 word management tests |
| `web-client/e2e/study-flow.spec.ts` | New — 5 study flow tests |
| `web-client/e2e/spaced-repetition.spec.ts` | New — 2 spaced repetition tests |
| `web-client/e2e/chengyu.spec.ts` | New — 4 chengyu tests |
| `web-client/e2e/global-setup.ts` | New — Emulator health check |
| `web-client/playwright.config.ts` | Added globalSetup, actionTimeout, increased webServer timeout |
| `.github/workflows/ci.yml` | Added e2e-tests job |
