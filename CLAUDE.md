# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HanLearn is a Chinese language learning application with spaced repetition for vocabulary and daily chengyu (成语) challenges. It uses a React/TypeScript frontend with Firebase backend services.

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
- **Styling**: CSS Modules (`.module.css` files)

#### State Management

Redux state structure in [web-client/src/types/store.ts](web-client/src/types/store.ts):
- `addWords` - User's word bank and loading state
- `auth` - Firebase user ID, loading, initialization status
- `settings` - Speech synthesis/recognition availability and voice selection

Actions in [web-client/src/store/actions/](web-client/src/store/actions/) use thunks that call service layer functions.

#### Service Layer

- [web-client/src/services/wordService.ts](web-client/src/services/wordService.ts) - All Firestore operations for word management
- [web-client/src/services/dictionaryService.ts](web-client/src/services/dictionaryService.ts) - Static dictionary loading and search (lazy-loaded, indexed in-memory)

#### Component Pattern

Components use `connect()` with `ConnectedProps<typeof connector>` for type-safe Redux connections. Hooks (`useState`, `useEffect`, `useCallback`, `useRef`) are used within components.

### Firebase Services

Configuration in [web-client/src/firebase/config.ts](web-client/src/firebase/config.ts) with emulator detection.

#### Firestore Data Model

```
users/{userId}/
  ├── email, username, createdAt
  └── userWords/{wordId}
      ├── wordData: { simp, trad, pinyin, meaning }
      ├── amendedMeaning: string | null
      ├── bank: 1-5              # Spaced repetition level
      └── dueDate: Timestamp     # Next review date

chengyus/{chengyuId}
  └── characters, pinyin, meaning
```

Security rules in [firestore.rules](firestore.rules): users can only access their own data.

#### Cloud Functions

[functions/src/index.ts](functions/src/index.ts) - Callable functions for server-side operations:
- `translateWithDeepL` - Translation with server-side API key
- `getDailyChengyu` - Rotates through chengyus daily
- `lookupChengyuChar` - Character details for chengyu quiz

#### Authentication

[web-client/src/firebase/auth.ts](web-client/src/firebase/auth.ts) - Firebase Auth wrappers for register/login/logout. User documents created in Firestore on signup.

### Static Dictionary

The CC-CEDICT dictionary (~124K entries) is served as static JSON at `/dictionary.json` to avoid Firestore read costs. Built via `npm run build:dict` which parses the source file and outputs to `web-client/public/dictionary.json`.

### Spaced Repetition Algorithm

In [web-client/src/services/wordService.ts](web-client/src/services/wordService.ts):
- **5 bank levels** with intervals: 1, 3, 7, 30, 60 days
- Score of 4 advances bank; score < 4 resets to bank 1
- Due date calculated from bank level + current date

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
