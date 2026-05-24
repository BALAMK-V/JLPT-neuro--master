# JLPT Neuro Master — Claude Code Guide

## Project Overview

Full-stack JLPT Japanese study platform.  
**Backend**: Django 4 + Django REST Framework + SimpleJWT  
**Frontend**: React 18 + Vite + TypeScript (no external component library)  
**Database**: PostgreSQL (Docker) / SQLite (local dev)  
**Auth**: JWT stored in `localStorage` (`access_token`, `refresh_token`)

---

## Running Locally

```bash
# Docker (full stack)
docker compose up --build

# Backend only (SQLite dev mode)
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo          # creates admin / bala / demo accounts
python manage.py runserver

# Frontend only
cd frontend
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| UI      | http://127.0.0.1:5174/ |
| API     | http://127.0.0.1:8001/api/ |
| Admin   | http://127.0.0.1:8001/admin/ |

**Demo accounts** (all password `Test@123`):

| Username | `is_staff` | `is_superuser` | Role |
|----------|-----------|----------------|------|
| `admin`  | ✓ | ✓ | Superuser — full Django admin access |
| `bala`   | ✓ | ✗ | Management user — imports, user mgmt |
| `demo`   | ✗ | ✗ | Regular learner |

> Re-running `seed_demo` is idempotent — safe to run on an existing DB.

---

## User Roles

The app has two roles, determined by Django's built-in `is_staff` flag:

| Role | `is_staff` | What they see |
|------|-----------|---------------|
| **User** | `false` | All learning features (flashcards, kanji, vocab, listening, reading, grammar, tests, AI tools, notes, sessions, profile, appearance) |
| **Management** | `true` | All user features + **Imports**, **Upload Paper**, **User Management** |

- The frontend exposes `me.is_staff` from `GET /api/auth/me/`.
- Management routes are filtered out of the sidebar for regular users.
- Backend import endpoints enforce `IsManagementUser` from `apps/users/permissions.py`.

---

## Architecture

### Backend apps

```
apps/
  assessment/     Test management
  content/        Kanji, Vocabulary
  flashcards/     Deck + card SRS (SM-2 and FSRS-4.5) + ImportLog
  grammar/        Grammar questions + AI check
  import_utils.py Shared multi-format file parser (CSV / JSON / XLSX)
  jlpt_exam/      Full JLPT exam simulation
  listening/      Audio comprehension + ZIP audio import
  neuro/          Learning-style assessment
  notes/          Quick / context / session notes
  ocr/            Question paper OCR + AI parse + import
  quiz_room/      Multiplayer WebSocket quiz
  reading/        Reading comprehension
  tracking/       Sessions, progress, dashboard
  users/          Auth, profiles, appearance, user management
```

### Key files

| File | Purpose |
|------|---------|
| `apps/import_utils.py` | `parse_import_file(file, filename)` — returns `list[dict]`; handles CSV, JSON, XLSX |
| `apps/flashcards/models.py` | `ImportLog` model — audit record for every completed import |
| `apps/flashcards/views.py` | `ImportLogListView` — GET list (100 entries), DELETE by id |
| `users/permissions.py` | `IsManagementUser` permission class |
| `users/serializers.py` | `MeSerializer` — exposes `is_staff` (read-only) |
| `users/views.py` | `MeView`, `RegisterView`, `ChangePasswordView`, `ForgotPasswordView`, `ResetPasswordView`, `UserManagementListView`, `UserManagementDetailView` |
| `users/auth_urls.py` | All auth + user management URL patterns under `/api/auth/` |
| `users/management/commands/seed_demo.py` | Creates admin / bala / demo idempotently |

### User management API

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/auth/users/` | Management | List all users |
| POST | `/api/auth/users/` | Management | Create user (can set `is_staff`) |
| PATCH | `/api/auth/users/<id>/` | Management | Update role / active / password |
| DELETE | `/api/auth/users/<id>/` | Management | Delete user |

### Import log API

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/flash/import-log/` | Management | Last 100 import records |
| DELETE | `/api/flash/import-log/<id>/` | Management | Delete a log entry |

### Frontend structure

```
src/
  app/
    api/          client.ts (JWT fetch wrapper), form.ts (multipart)
    state/        route.ts (hash routing + managementOnly flag), user.tsx, appearance.tsx
    theme/        neuro.ts (CSS var injection per learning style)
    labels.ts     learning style labels and aliases
    learningStyle.ts  session/reminder/question count plans
  components/
    imports/      CsvEditor, validators.ts, ValidationSummary, csv.ts
    ui/           Badge, Divider, EmptyState, FormField, Modal, Notice, SectionHeader, Stack, Text
    PageHeader, SideMenu, QuickNoteButton, FocusAudioWidget, CompanionWidget
  pages/          One file per route
  styles/         global.css (single stylesheet, BEM-like naming)
  types.ts        All TypeScript types
```

### Routing

Hash-based (`/#flashcards`, `/#kanji`, etc.) with two path exceptions:
- `/neuro-analysis` → `neuroAnalysis` route
- `/settings/appearance` → `appearance` route

Routes marked `managementOnly: true` in `route.ts` are filtered from the sidebar for non-staff users.

### Sidebar navigation groups

`SideMenu.tsx` renders collapsible groups (chevron toggle, active group starts expanded):

| Group | Icon | Routes |
|-------|------|--------|
| Dashboard | 📊 | dashboard |
| Study | ✎ | kanji, vocab, grammar, listening, reading |
| Practice | 🃏 | flashcards, tests, jlptExam |
| AI Tools | ✦ | aiExamGen, grammarCheck, speakingMode, sentenceMining |
| Social | ⚡ | multiplayerQuiz |
| Notebook | ✏ | notes, sessions |
| Settings | ◐ | profile, neuroAnalysis, appearance |
| Management | ↓ | imports, paperUpload, userManagement *(staff only)* |

---

## CSS Conventions

Single stylesheet at `frontend/src/styles/global.css`. Class naming conventions:

| Prefix | Used for |
|--------|---------|
| `.fc-*` | Flashcard review UI (Anki flip card, stats, ratings, session limit) |
| `.fc-anki-*` | 3-D flip card faces (preserve-3d, backface-visibility) |
| `.fc-deck-*` | Deck header and badge area |
| `.fc-stats-*` | Per-deck stat row (total/due/new/learning/review/suspended) |
| `.nav-group*` | Collapsible sidebar section header + items |
| `.auth-*` | Auth page (login / register / reset) |
| `.um-*` | User Management page |
| `.deck-*` | Flashcard deck sidebar items |
| `.neuro-*` | Neuro analysis page |
| `.notice--ok/bad` | Status banners |
| `.btn--primary/danger` | Button variants |
| `.pill` | Inline metadata tags |

---

## Import System

All imports are **management-only** (frontend sidebar filter + backend `IsManagementUser`).  
Accepted file formats: **CSV**, **JSON**, **XLSX** (via `apps/import_utils.py`).  
Every successful import writes an `ImportLog` record visible in the History tab.

| Content type | Endpoint | Required fields |
|-------------|----------|----------------|
| Kanji | `POST /api/kanji/import/` | `character, meaning_en, jlpt_level` |
| Vocabulary | `POST /api/vocab/import/` | `word, reading, meaning_en, jlpt_level` |
| Grammar | `POST /api/grammar/import/` | `prompt, option_a–d, answer` |
| Reading | `POST /api/reading/import/` | `passage_title, passage_type, jlpt_level, text_jp, question, option_a–d, answer` |
| Listening | `POST /api/listening/import/` | `audio_file, question, option_a–d, answer` |
| Listening audio | `POST /api/listening/audio/import/` | ZIP file of audio files |
| Flashcards | `POST /api/flash/import/` | `front, back` |

Sample CSV templates (N2-level data) live in `frontend/public/templates/`.  
Frontend validation: `frontend/src/components/imports/validators.ts`.  
Max file size: **5 MB** CSV/JSON/XLSX, **50 MB** ZIP.

### Flashcard import — deck options

When importing flashcards, Step 2 lets the user:
- **Existing deck** — select from unlocked decks; shows level badge, type, card count, due count
- **New deck** — enter name + pick JLPT level (N5–N1), deck type (custom/kanji/vocab/combined/mixed), SRS algo (SM-2 or FSRS-4.5)

---

## Auth Flow

- **Login**: `POST /api/auth/token/` → stores `access_token` + `refresh_token` in localStorage
- **Register**: `POST /api/auth/register/`
- **Forgot password**: `POST /api/auth/forgot-password/` — returns `dev_token` (uid:token) in dev mode
- **Reset password**: `POST /api/auth/reset-password/` with `uid`, `token`, `new_password`
- **Change password**: `POST /api/auth/change-password/` (authenticated)
- **Token refresh**: automatic via `api()` client on 401

Token lifetimes: **access 2 hours**, **refresh 30 days** (survives `docker restart`).  
Only `docker compose down -v` (volume wipe) invalidates tokens.

---

## Flashcard SRS

Two algorithms per deck: **SM-2** (default) and **FSRS-4.5**.  
Review UI: full Anki-style 3-D flip card.

- Front face: question text + "Press Space / tap to reveal" hint
- Back face: front echo + divider + answer (pre-rotated `rotateY(180deg)`; parent card flips on reveal)
- Rating buttons: `Again (1) / Hard (2) / Good (3) / Easy (4)` — keyboard shortcuts active
- **Session limit** picker in deck sidebar (5 / 10 / 15 / 20 / 25 / 30 / 50 / 100 cards); default from learning-style plan
- Leeches (8+ lapses) shown in banner with unsuspend option

> CSS fix note: `.fc-anki-front` and `.fc-anki-back` must be **direct children** of `.fc-anki-card` (no wrapper div) for `transform-style: preserve-3d` + `backface-visibility: hidden` to work correctly.

---

## Migrations

Each app has a single `0001_initial.py` migration (squashed clean slate as of v0.4.0).  
To reset a local dev database:

```bash
cd backend
rm db.sqlite3
python manage.py migrate
python manage.py seed_demo
```

---

## File Tree

```
JLPT NEURO MASTER/
├── docker-compose.yml
├── VERSION
├── CLAUDE.md
├── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── imports/
│   └── exports/
│
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env  /  .env.example
│   ├── docker/
│   │   └── wait_for_db.py
│   ├── jlpt_neuro_master/          ← Django project package
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   ├── wsgi.py
│   │   └── celery.py
│   └── apps/
│       ├── import_utils.py         ← shared CSV/JSON/XLSX parser
│       ├── assessment/
│       │   ├── models.py
│       │   ├── serializers.py
│       │   ├── views.py
│       │   └── migrations/0001_initial.py
│       ├── content/
│       │   ├── models.py           ← Kanji, KanjiExample, Vocabulary
│       │   ├── serializers.py
│       │   ├── views.py            ← import views (kanji, vocab)
│       │   ├── ai_views.py
│       │   └── migrations/0001_initial.py
│       ├── flashcards/
│       │   ├── models.py           ← Deck, Card, ImportLog
│       │   ├── serializers.py
│       │   ├── views.py            ← deck/card CRUD, review, import, import-log
│       │   ├── fsrs_engine.py      ← FSRS-4.5 algorithm
│       │   ├── mine_views.py       ← sentence mining
│       │   └── migrations/0001_initial.py
│       ├── grammar/
│       │   ├── models.py
│       │   ├── serializers.py
│       │   ├── views.py
│       │   ├── importer.py
│       │   ├── ai_views.py
│       │   └── migrations/0001_initial.py
│       ├── jlpt_exam/
│       │   ├── models.py           ← JLPTExam, UserExamSession, ExamResult, …
│       │   ├── serializers.py
│       │   ├── views.py
│       │   ├── ai_generator.py
│       │   ├── analysis.py
│       │   └── migrations/0001_initial.py
│       ├── listening/
│       │   ├── models.py
│       │   ├── serializers.py
│       │   ├── views.py            ← question import + ZIP audio import
│       │   └── migrations/0001_initial.py
│       ├── neuro/
│       │   ├── models.py           ← NeuroQuestion, UserNeuroProfile, …
│       │   ├── serializers.py
│       │   ├── views.py
│       │   ├── scoring.py
│       │   └── migrations/0001_initial.py
│       ├── notes/
│       │   ├── models.py
│       │   ├── serializers.py
│       │   ├── views.py
│       │   └── migrations/0001_initial.py
│       ├── ocr/
│       │   ├── models.py           ← QuestionPaper
│       │   ├── serializers.py
│       │   ├── views.py
│       │   ├── processor.py
│       │   ├── parser.py
│       │   ├── ai_cleaner.py
│       │   ├── tasks.py            ← Celery async OCR task
│       │   └── migrations/0001_initial.py
│       ├── quiz_room/
│       │   ├── consumers.py        ← Django Channels WebSocket consumer
│       │   └── routing.py
│       ├── reading/
│       │   ├── models.py           ← ReadingPassage, ReadingQuestion
│       │   ├── serializers.py
│       │   ├── views.py
│       │   ├── importer.py
│       │   └── migrations/0001_initial.py
│       ├── tracking/
│       │   ├── models.py           ← Session, UserProgress
│       │   ├── serializers.py
│       │   ├── views.py
│       │   └── migrations/0001_initial.py
│       └── users/
│           ├── models.py           ← UserProfile, UserAppearanceSettings, StudyCompanion
│           ├── serializers.py      ← MeSerializer (exposes is_staff)
│           ├── views.py
│           ├── auth_urls.py
│           ├── permissions.py      ← IsManagementUser
│           ├── signals.py
│           ├── migrations/0001_initial.py
│           └── management/commands/
│               ├── seed_demo.py    ← creates admin / bala / demo
│               └── seed_default_users.py
│
└── frontend/
    ├── public/
    │   ├── app_icon.png
    │   └── templates/              ← N2-level sample CSV files
    │       ├── kanji_import_sample.csv
    │       ├── vocab_import_sample.csv
    │       ├── grammar_import_sample.csv
    │       ├── listening_import_sample.csv
    │       ├── reading_import_sample.csv
    │       └── flashcards_import_sample.csv
    └── src/
        ├── main.tsx
        ├── types.ts                ← all shared TypeScript types
        ├── api/
        │   └── exam.ts
        ├── app/
        │   ├── App.tsx
        │   ├── api/
        │   │   ├── client.ts       ← JWT Bearer fetch + auto-refresh
        │   │   └── form.ts         ← multipart FormData helper
        │   ├── state/
        │   │   ├── route.ts        ← hash router + managementOnly flag
        │   │   ├── user.tsx
        │   │   └── appearance.tsx
        │   ├── theme/
        │   │   └── neuro.ts        ← CSS variable injection per learning style
        │   ├── labels.ts
        │   └── learningStyle.ts    ← session card limits + study cues
        ├── components/
        │   ├── SideMenu.tsx        ← collapsible nav groups
        │   ├── PageHeader.tsx
        │   ├── LoginForm.tsx
        │   ├── AudioPlayer.tsx
        │   ├── FocusAudioWidget.tsx
        │   ├── KanjiCard.tsx
        │   ├── VocabCard.tsx
        │   ├── ProgressBar.tsx
        │   ├── QuickNoteButton.tsx
        │   ├── ScoreHistoryChart.tsx
        │   ├── SessionTracker.tsx
        │   ├── TestScreen.tsx
        │   ├── appearance/
        │   │   ├── BackgroundUploader.tsx
        │   │   ├── ColorPicker.tsx
        │   │   ├── FontSelector.tsx
        │   │   ├── PreviewPanel.tsx
        │   │   └── ThemeToggle.tsx
        │   ├── companion/
        │   │   └── CompanionWidget.tsx
        │   ├── exam/
        │   │   ├── AnalysisPanel.tsx
        │   │   ├── ExamAudioPlayer.tsx
        │   │   ├── ImageViewer.tsx
        │   │   ├── NavigationPanel.tsx
        │   │   ├── QuestionCard.tsx
        │   │   ├── QuestionEditor.tsx
        │   │   ├── ResultDashboard.tsx
        │   │   └── TimerDisplay.tsx
        │   ├── focus/
        │   │   └── useBrownNoise.ts
        │   ├── imports/
        │   │   ├── CsvEditor.tsx
        │   │   ├── ValidationSummary.tsx
        │   │   ├── csv.ts
        │   │   └── validators.ts
        │   ├── neuro/
        │   │   ├── QuestionCard.tsx
        │   │   ├── ResultScreen.tsx
        │   │   ├── TreeVisualization.tsx
        │   │   └── sound.ts
        │   ├── reading/
        │   │   ├── ReadingMcq.tsx
        │   │   └── ReadingPassageView.tsx
        │   └── ui/                 ← shared primitives
        │       ├── index.ts
        │       ├── Badge.tsx
        │       ├── Divider.tsx
        │       ├── EmptyState.tsx
        │       ├── FormField.tsx
        │       ├── Modal.tsx
        │       ├── Notice.tsx
        │       ├── SectionHeader.tsx
        │       ├── Stack.tsx
        │       └── Text.tsx
        ├── pages/
        │   ├── AIExamGeneratorPage.tsx
        │   ├── AppearanceSettingsPage.tsx
        │   ├── AuthPage.tsx
        │   ├── DashboardPage.tsx
        │   ├── ExamResultPage.tsx
        │   ├── FlashcardsPage.tsx
        │   ├── GrammarCheckPage.tsx
        │   ├── GrammarPage.tsx
        │   ├── ImportsPage.tsx
        │   ├── JLPTExamPage.tsx
        │   ├── KanjiPage.tsx
        │   ├── ListeningPage.tsx
        │   ├── MultiplayerQuizPage.tsx
        │   ├── NeuroAnalysisPage.tsx
        │   ├── NotesPage.tsx
        │   ├── PaperUploadPage.tsx
        │   ├── ProfilePage.tsx
        │   ├── ReadingPage.tsx
        │   ├── SentenceMiningPage.tsx
        │   ├── SessionsPage.tsx
        │   ├── SpeakingModePage.tsx
        │   ├── TestsPage.tsx
        │   ├── UserManagementPage.tsx
        │   └── VocabPage.tsx
        └── styles/
            └── global.css          ← single stylesheet, BEM-like naming
```

---

## Learning Styles

Three modes stored in `profile.learning_type` + `profile.ui_prefs.learning_alias`:

| Alias | Type | Behaviour |
|-------|------|----------|
| `balanced` | balanced | 25-min sessions, standard UI |
| `quick_reset` | focus_support | 10-min sessions, quick reset cues |
| `focus_support` | focus_support | 15-min sessions, focus prompts |
| `calm_structure` | calm_structure | 20-min sessions, reduced motion, low complexity |

CSS variables injected by `applyNeuroUiMode()` in `app/theme/neuro.ts`.
