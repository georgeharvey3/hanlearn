# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HanLearn is a Chinese language learning application with spaced repetition for vocabulary and daily chengyu (成语) challenges. It uses a React/TypeScript frontend with Firebase backend services.

[CONTEXT.md](CONTEXT.md) holds the domain glossary — read it for the words the code uses (direction, bank/level, session queue, new word).

## Development Commands

### Full Development Environment

```bash
npm run dev              # Start Firebase emulators + Vite dev server
npm run dev:client       # Just Vite dev server (localhost:3000)
npm run emulators        # Just Firebase emulators
```

### Build & Deploy

```bash
npm run build            # Build dictionary + frontend
npm run build:dict       # Build static dictionary JSON from CC-CEDICT
npm run deploy           # Build and deploy to Firebase Hosting
npm run deploy:functions # Build and deploy Cloud Functions only
npm run deploy:all       # Build and deploy everything (hosting, functions, rules, indexes)
```

### Frontend (web-client/)

```bash
cd web-client
npm install
npm start                # Vite dev server on localhost:3000
npm test                 # Run tests
npm run build            # Production build to dist/
```

### Cloud Functions (functions/)

```bash
cd functions
npm install
npm run build            # Compile TypeScript
npm run serve            # Run functions locally
```

## Architecture

### Frontend (React + TypeScript + Redux)

The frontend uses **Vite**, **TypeScript**, and **Redux with thunks**:

- **Entry Point**: [web-client/src/index.tsx](web-client/src/index.tsx) - Redux store setup with three reducers
- **Routing**: [web-client/src/App.tsx](web-client/src/App.tsx) - React Router v5, speech API initialization
- **Styling**: MUI component library (`@mui/material`) with the `sx` prop for inline styles; no CSS Modules are used

#### State Management

Redux state structure in [web-client/src/types/store.ts](web-client/src/types/store.ts):

- `addWords` - User's word list and loading state
- `auth` - Firebase user ID, loading, initialization status
- `settings` - Speech synthesis/recognition availability and voice selection

Actions in [web-client/src/store/actions/](web-client/src/store/actions/) use thunks that call service layer functions.

#### Service Layer

- [web-client/src/services/wordService.ts](web-client/src/services/wordService.ts) - All Firestore operations for word management
- [web-client/src/services/dictionaryService.ts](web-client/src/services/dictionaryService.ts) - Static dictionary loading and search (lazy-loaded, indexed in-memory)
- [web-client/src/services/streakService.ts](web-client/src/services/streakService.ts) - Read/write `testCompletions` subcollection; calculates streak from completion dates
- [web-client/src/services/dashboardService.ts](web-client/src/services/dashboardService.ts) - Aggregates stats (due count, streak, level distribution) for the Dashboard
- [web-client/src/services/retentionService.ts](web-client/src/services/retentionService.ts) - Read/write the `reviewStats` daily rollup; the session's write joins the `finishTest` batch
- [web-client/src/services/statsService.ts](web-client/src/services/statsService.ts) - Assembles the scheduler metrics for the `/stats` page
- [web-client/src/services/sentenceService.ts](web-client/src/services/sentenceService.ts) - Firebase AI Logic: generates and caches example sentences in `sentenceCache`
- [web-client/src/services/chengyuSentenceService.ts](web-client/src/services/chengyuSentenceService.ts) - Generates example sentences for chengyu display
- [web-client/src/services/decompositionService.ts](web-client/src/services/decompositionService.ts) - Calls cloud function to decompose characters into radicals/components
- [web-client/src/services/ttsService.ts](web-client/src/services/ttsService.ts) - Text-to-speech via Howler.js; called directly from components (not via Redux)

Note: `ttsService`, `sentenceService`, `decompositionService`, and `dictionaryService` are called directly from components (not via Redux thunks) — this is intentional for operations that are UI-local and do not need shared global state.

#### Component Pattern

Components use `connect()` with `ConnectedProps<typeof connector>` for type-safe Redux connections. Hooks (`useState`, `useEffect`, `useCallback`, `useRef`) are used within components.

### Firebase Services

Configuration in [web-client/src/firebase/config.ts](web-client/src/firebase/config.ts) with emulator detection.

#### Firestore Data Model

```
users/{userId}/
  ├── email, username, createdAt
  ├── wordLists/{listId}
  │   └── name, order, createdAt
  ├── userWords/{wordId}
  │   ├── wordData: { simp, trad, pinyin, meaning }
  │   ├── amendedMeaning: string | null
  │   ├── level: 1-5             # Derived: lowest bank across directions (stored as `bank`)
  │   ├── dueDate: Timestamp     # Derived: earliest dueDate across directions
  │   ├── directions: {          # Per-direction scheduling state (see ADR 0002)
  │   │     MC | MP | PM | PC | CM: {
  │   │       bank: 1-5, dueDate: Timestamp,
  │   │       stability: number, difficulty: 1-10, interval: number,
  │   │       lastReview: Timestamp, toneErrors?: number, lapses?: number
  │   │     }
  │   │   }
  │   └── listId?: string        # Optional word list membership
  ├── testCompletions/{dateId}   # Streak tracking (dateId = YYYY-MM-DD)
  │   ├── testsCount: number
  │   └── completedAt: Timestamp
  └── reviewStats/{dateId}       # Scheduler measurement (dateId = YYYY-MM-DD)
      ├── date: string           # Same value as the doc id, so the range query needs no index
      ├── updatedAt: Timestamp
      └── directions: {          # Counters per direction, written as increments
            MC | MP | PM | PC | CM: {
              attempts, reviews, reviewPasses,
              promoted, held, demoted: number
            }
          }

words/{wordId}                   # Read-only shared dictionary (admin-managed)
chengyus/{chengyuId}             # Read-only (admin-managed)
  └── characters, pinyin, meaning
dailyChengyu/{dateKey}           # Written by cloud function, read-only to clients
sentenceCache/{word}             # AI-generated sentences; public read, auth write
rateLimits/{userId}/...          # Cloud Functions only (Admin SDK); client access denied
```

Security rules in [firestore.rules](firestore.rules): users can only access their own data.

#### Cloud Functions

[functions/src/index.ts](functions/src/index.ts) - Callable functions for server-side operations:

- `getDailyChengyu` - Rotates through chengyus daily
- `lookupChengyuChar` - Character details for chengyu quiz

#### Authentication

[web-client/src/firebase/auth.ts](web-client/src/firebase/auth.ts) - Firebase Auth wrappers for register/login/logout. User documents created in Firestore on signup.

### Static Dictionary

The CC-CEDICT dictionary (~124K entries) is served as static JSON at `/dictionary.json` to avoid Firestore read costs. Built via `npm run build:dict` which parses the source file and outputs to `web-client/public/dictionary.json`.

### Spaced Repetition Algorithm

The calculation is in [web-client/src/utils/scheduling.ts](web-client/src/utils/scheduling.ts), and `finishTest` in [web-client/src/services/wordService.ts](web-client/src/services/wordService.ts) holds the Firestore write:

- The scheduler is **FSRS** (`ts-fsrs`), with a target retention of 0.9, no learning steps, and the FSRS-6 default weights
- Each direction carries a **stability** (days at which recall is 0.9), a **difficulty** (1 to 10), an **interval** in days, and the date of its **last review**
- `pass` sends the Good rating; `lapse` and `fail` both send Again, and a `fail` also resets the interval to 0, which asks the direction again the next day
- A failed retrieval **demotes** a direction and never resets it: the stability after it never exceeds the stability before it, and a `lapse` comes back in 1 to 3 days. Each direction counts its lapses, and one with 8 or more is a **leech**, flagged in the word list. See [docs/adr/0010-partial-demotion-and-leeches.md](docs/adr/0010-partial-demotion-and-leeches.md)
- FSRS reads the elapsed days since the last review, so a late correct answer gives a longer interval
- The maximum interval is 365 days, and the due date takes a fuzz of up to 5%
- **5 levels** are bands of the interval: 1 (0 days), 2 (1-6), 3 (7-29), 4 (30-59), 5 (60+). See [docs/adr/0009-fsrs.md](docs/adr/0009-fsrs.md)
- The scheduler is **measured** by a daily rollup in `reviewStats`, which the `/stats` page reads: true retention, promotion and stall rate per direction, median mature interval, and the review load ahead. The counting rules are pure, in [web-client/src/utils/retention.ts](web-client/src/utils/retention.ts). See [docs/adr/0013-retention-metrics.md](docs/adr/0013-retention-metrics.md)
- Each word carries its own level and due date **per direction** (`MC`, `MP`, `PM`, `PC`, `CM`); the top-level `bank`/`dueDate` are derived so Firestore can still range-query them. See [docs/adr/0002-direction-level-scheduling.md](docs/adr/0002-direction-level-scheduling.md)

## Firebase Emulators

Development uses local emulators (configured in [firebase.json](firebase.json)):

- Auth: localhost:9099
- Firestore: localhost:8082
- Functions: localhost:5001
- Emulator UI: localhost:4000

## Important Notes

- The `api/` directory contains a legacy Flask backend that is no longer used
- Type definitions are in [web-client/src/types/](web-client/src/types/)
- The `amendedMeaning` field allows users to override dictionary definitions
- Chengyu challenges rotate daily based on days since May 24, 2021

## Design Principles

- **Mobile-first**: The app is primarily used on mobile devices during study sessions
- **Minimal friction**: Getting into a study session should require as few taps as possible
- **Chinese-centric UI**: Hanzi should be large and legible; pinyin is secondary
- **Progressive disclosure**: Advanced settings and stats are available but not in the way
- **Offline-tolerant**: Core study flows should degrade gracefully without a network connection
- **No dark patterns**: No streaks that punish missing a day, no notification spam

## Known Issues & Tech Debt

- Testing libraries upgraded to RTL v16, user-event v14, Vitest — 40 tests passing as of 2026-02-26
- Redux `connect()` pattern is used throughout; consider migrating to hooks (`useSelector`/`useDispatch`) over time
- React Router v5 is used; v6 migration would be beneficial but is a large refactor
- `ammended_meaning` field on the `Word` model has a typo (double-m); threaded through models, service, and tests — fix requires coordinated rename
- Error boundaries exist (`components/ErrorBoundary/`) but coverage is incomplete
- Speech synthesis/recognition is browser-dependent with no consistent fallback UI
- `Chengyu` interface defined twice: `types/models.ts` (has `story?`) and `data/chengyus.ts` (has `trad`) — shapes differ; should consolidate
- `data/chengyus.ts` mixes 900+ lines of static data with a service-dependent helper (`lookupCharMeanings`); should split into data + utility

## Prioritised Roadmap

### Now (current focus)

- Autonomous development workflow: testing infrastructure, CI/CD, PR-based review

### Next

- Improve spaced repetition: show due-date countdown, allow manual level adjustment
- Dashboard improvements: streak and level distribution are implemented; progress charts still TODO
- Better chengyu UX: example sentences added; stroke order hints still TODO

### Later

- Offline support via service worker + IndexedDB caching
- React Router v6 migration
- Redux hooks migration
- Sentence mining: save sentences alongside words

### Deferred / Won't do soon

- Mobile native app (web app is sufficient for now)
- Social/multiplayer features

## Testing Conventions

### Unit / Integration Tests (Vitest + React Testing Library)

- Test files live alongside source: `ComponentName.test.tsx`
- Use `src/test/utils.tsx` for render helpers that wrap with Redux store and Router
- Firebase calls should be mocked at the service layer (not at the Firebase SDK level)
- Test scripts: `npm test` (watch), `npm run test:run` (CI, single run), `npm run test:coverage`

### Firestore Rules Tests (Vitest + the Firestore emulator)

- Tests live in `tests/rules/`, run from the repo root, and read `firestore.rules` as the repository has it
- `npm run test:rules` — `firebase emulators:exec` starts and stops the Firestore emulator around the suite, so it needs Java
- Every case writes the shape the app actually writes. A rule that allows a shape no caller sends proves nothing, and a field missing from the rules is how ADR 0010's `lapses` silently broke every reschedule after a lapse

### End-to-End Tests (Playwright)

- Tests live in `web-client/e2e/`
- Always use Firebase emulators — never hit production
- Seed test users via `web-client/e2e/fixtures/seed.ts` before each test
- Test script: `npm run test:e2e`

### Firebase Emulators for Tests

- Start emulators before e2e tests: `npm run emulators` from repo root
- Emulator data is ephemeral — tests must seed their own data

## Git Conventions

### Branching Model

```
feature/xyz ──PR──▸ develop ──PR──▸ main ──▸ production deploy + GitHub Release
```

- `develop` — integration branch; all feature PRs target this
- `main` — production branch; only updated via PRs from `develop`

### Branch Rules

- Always create a new branch from `develop`: `claude/{task-description}` (e.g. `claude/fix-auth-redirect`)
- Commit messages should summarise what was done and why, not just what files changed
- Never push directly to `main` or `develop`
- All Claude-authored changes go through a PR for review
- Pull the latest `develop` before starting any task: `git checkout develop && git pull`

### Release Process

1. Feature branches are merged into `develop` via PR (CI runs automatically)
2. When ready to release, create a PR from `develop` → `main`
3. On merge to `main`, the deploy workflow automatically:
   - Builds web-client and Cloud Functions
   - Deploys hosting, functions, Firestore rules, and indexes to Firebase
4. After a successful deploy, the release workflow automatically:
   - Creates a date-based git tag (e.g. `v1.2026.0316`)
   - Creates a GitHub Release with auto-generated changelog
