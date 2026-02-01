# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HanLearn is a Chinese language learning application with spaced repetition for vocabulary and daily chengyu (成语) challenges. It consists of a React frontend and Flask backend.

## Development Commands

### Frontend (hanlearn-react/)
```bash
cd hanlearn-react
npm install        # Install dependencies
npm start          # Start development server on http://localhost:3000
npm test           # Run tests in watch mode
npm run build      # Production build
```

### Backend (hanlearn-python/)
```bash
cd hanlearn-python
pip install -r requirements.txt    # Install dependencies
python wsgi.py                      # Run Flask development server
# OR with gunicorn:
gunicorn wsgi:app
```

The React app proxies API requests to `http://localhost:5000` (configured in [hanlearn-react/package.json](hanlearn-react/package.json)).

## Architecture

### Backend Structure (Flask)

The Flask application uses the **application factory pattern** with blueprints:

- **App Factory**: [hanlearn-python/app/__init__.py](hanlearn-python/app/__init__.py) - `create_app()` initializes Flask, SQLAlchemy, and registers blueprints
- **Blueprints**:
  - `main` - Core word operations, testing, sentences, translations
  - `auth` - User registration and login
- **Database**: SQLite with SQLAlchemy ORM ([hanlearn-python/app/models.py](hanlearn-python/app/models.py))
- **Authentication**: JWT tokens with `@token_required` decorator ([hanlearn-python/app/decorators.py](hanlearn-python/app/decorators.py))

#### Database Models

Three core models with relationships:

- **Word**: Chinese vocabulary entries (simplified, traditional, pinyin, meaning)
- **User**: User accounts with hashed passwords
- **UserWord**: Join table linking users to their word bank with spaced repetition data:
  - `bank` (1-5): Difficulty level that increases when word is mastered
  - `due_date`: Next review date based on spaced repetition algorithm
  - `ammended_meaning`: User-customized definition override

The spaced repetition system in [hanlearn-python/app/main/views.py](hanlearn-python/app/main/views.py) adjusts `bank` levels and calculates new `due_date` values based on test performance.

#### Key API Endpoints

**Word Management** (main blueprint):
- `/api/add-word` - Add existing word to user's bank
- `/api/add-custom-word` - Create and add new word (constructs pinyin/trad from character lookups)
- `/api/remove-word` - Remove word from user's bank
- `/api/get-user-words` - Get all user's words with due dates
- `/api/get-due-user-words` - Get only words due for review
- `/api/update-word-meaning` - Update user's custom meaning

**Testing & Learning**:
- `/api/finish-test` - Submit test results, update banks and due dates
- `/api/get-sentences/<word>` - Fetch example sentences via Reverso API with jieba segmentation
- `/api/get-chengyu` - Daily chengyu challenge (rotates through chengyus.txt)
- `/api/translate-sentence` - Google Translate integration

**Auth** (auth blueprint):
- `/api/create-user` - Register new user
- `/api/login` - JWT token authentication

### Frontend Structure (React + Redux)

The frontend uses **Redux with thunk middleware** for async operations and state management:

- **Store Configuration**: [hanlearn-react/src/index.js](hanlearn-react/src/index.js) - Combines three reducers
- **Reducers**:
  - `addWords` - Word bank state and operations
  - `auth` - Authentication state (token, userId, expiresAt)
  - `settings` - Speech synthesis/recognition settings
- **Actions**: [hanlearn-react/src/store/actions/](hanlearn-react/src/store/actions/) - Redux thunks for API calls

#### Main Containers (Pages)

- **Home**: Landing page
- **AddWords**: Search and add words to personal bank
- **TestWords**: Spaced repetition quiz for due words
- **TestChengyus**: Daily chengyu (idiom) challenge
- **Auth/Register**: User authentication flows
- **SettingsPage**: User preferences

#### Speech Integration

The app initializes Web Speech API on startup ([hanlearn-react/src/App.js](hanlearn-react/src/App.js)):
- **Speech Recognition** (`webkitSpeechRecognition`): For pronunciation practice
- **Speech Synthesis** (`SpeechSynthesisUtterance`): Text-to-speech for Chinese characters
- Detects and stores Chinese voices (zh-CN preferred) in Redux settings

#### Component Architecture

- **Layout**: Main layout wrapper with navigation
- **Navigation**: Toolbar and side drawer with responsive design
- **UI Components**: Reusable components in [hanlearn-react/src/components/UI/](hanlearn-react/src/components/UI/) (Table, Modal, Buttons, Input, Spinner, Toggle)
- **Test Logic**: Shared testing logic in [hanlearn-react/src/components/Test/Logic/](hanlearn-react/src/components/Test/Logic/)

### Data Flow

1. User adds word → Redux action → POST to `/api/add-word` → Creates UserWord entry with initial due_date
2. User takes test → TestWords fetches due words → User grades performance → POST to `/api/finish-test` → Backend updates bank levels and recalculates due_dates
3. Auth token stored in Redux and localStorage → Auto-login on app startup → Token passed in Authorization header for protected routes

## Key Technologies

**Frontend**:
- React 16.13 with React Router 5
- Redux with redux-thunk
- Howler.js for audio
- pinyin library for romanization

**Backend**:
- Flask with Flask-SQLAlchemy
- PyJWT for authentication
- Reverso API (reverso_api) for example sentences
- Jieba for Chinese text segmentation
- google-trans-new for translations

## Important Notes

- The requirements.txt includes many anaconda packages - only Flask-related packages are actually needed for the backend
- Authentication tokens expire after 365 days
- The spaced repetition algorithm uses 5 banks with increasing intervals
- Chengyu challenges rotate daily based on days since May 24, 2021
- Custom words construct traditional/pinyin by looking up constituent characters in the Word table
