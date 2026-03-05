# HanLearn

A Chinese language learning application featuring spaced repetition for vocabulary review and daily chengyu (成语) challenges.

## Features

- **Vocabulary Management** - Search a dictionary of ~124K entries (CC-CEDICT), save words to your personal word bank, and override definitions with your own notes
- **Spaced Repetition** - Review words using a 5-level spaced repetition system with intervals of 1, 3, 7, 30, and 60 days
- **Daily Chengyu Challenge** - Learn a new Chinese idiom every day with an interactive character quiz
- **Speech Support** - Text-to-speech pronunciation and speech recognition for practice (browser-dependent)
- **Mobile-First Design** - Optimised for studying on the go with large, legible hanzi

## Tech Stack

- **Frontend**: React, TypeScript, Redux, Vite
- **Backend**: Firebase (Authentication, Firestore, Cloud Functions, Hosting)
- **Dictionary**: CC-CEDICT served as static JSON to minimise database reads
- **Testing**: Vitest + React Testing Library (unit/integration), Playwright (e2e)

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)
- A Firebase project (for production deployment)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/georgeharvey3/hanlearn.git
cd hanlearn
```

### 2. Install dependencies

```bash
npm install
cd web-client && npm install
cd ../functions && npm install
cd ..
```

### 3. Build the dictionary

```bash
npm run build:dict
```

This parses the CC-CEDICT source file and outputs `web-client/public/dictionary.json`.

### 4. Start the development environment

```bash
npm run dev
```

This starts both the Firebase emulators and the Vite dev server. The app will be available at [http://localhost:3000](http://localhost:3000).

Alternatively, you can start them separately:

```bash
npm run emulators     # Firebase emulators only (UI at http://localhost:4000)
npm run dev:client    # Vite dev server only (http://localhost:3000)
```

### Firebase Emulator Ports

| Service    | Port  |
|------------|-------|
| Auth       | 9099  |
| Firestore  | 8082  |
| Functions  | 5001  |
| Emulator UI| 4000  |

## Running Tests

### Unit and integration tests

```bash
cd web-client
npm test              # Watch mode
npm run test:run      # Single run (CI)
npm run test:coverage # With coverage report
```

### End-to-end tests

```bash
# In one terminal, start emulators:
npm run emulators

# In another terminal:
cd web-client
npm run test:e2e
```

## Building for Production

```bash
npm run build    # Builds dictionary + frontend
npm run deploy   # Builds and deploys to Firebase Hosting
```

## Project Structure

```
hanlearn/
├── web-client/          # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── services/    # Dictionary and word management services
│   │   ├── store/       # Redux store, actions, and reducers
│   │   ├── types/       # TypeScript type definitions
│   │   └── firebase/    # Firebase config and auth helpers
│   ├── public/          # Static assets (dictionary.json)
│   └── e2e/             # Playwright end-to-end tests
├── functions/           # Firebase Cloud Functions
├── firestore.rules      # Firestore security rules
└── firebase.json        # Firebase project configuration
```

## License

See [LICENSE](LICENSE) for details.
